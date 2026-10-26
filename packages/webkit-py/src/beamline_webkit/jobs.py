# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""Long work as jobs: a route starts one and answers at once with its id; the work runs on a
thread (and may farm its computation out to a process pool); the page follows its progress
over Server-Sent Events and can cancel it.

A job is a callable ``fn(progress)``; it calls ``progress(done, total, message=None)`` as it
goes, which raises :class:`JobCancelled` once a cancel was requested, and returns a JSON-able
result (or stores its real result in the session and returns a summary).
:meth:`JobManager.router` serves ``GET /api/jobs/{id}``, ``GET /api/jobs/{id}/events`` and
``DELETE /api/jobs/{id}``.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
import uuid
from collections.abc import AsyncIterator, Callable
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Literal

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .app import NotFound

logger = logging.getLogger(__name__)

JobStatus = Literal["queued", "running", "done", "failed", "cancelled"]
FINISHED: frozenset[str] = frozenset({"done", "failed", "cancelled"})
ProgressFn = Callable[..., None]
"""``progress(done, total, message=None)``; raises :class:`JobCancelled` on a cancel request."""


class JobCancelled(Exception):
    """Raised inside a job, by its progress callback, once a cancel was requested."""


class JobState(BaseModel):
    """What a page sees of a job."""

    id: str
    name: str = Field(description="what the job does, for the page's message bar")
    status: JobStatus
    done: int = Field(0, description="steps done")
    total: int = Field(0, description="steps in all; 0 while unknown")
    message: str | None = Field(None, description="the step under way")
    error: str | None = Field(None, description="why it failed")
    result: Any = Field(None, description="what the job returned, once done")
    session: str | None = Field(None, description="the session that started it")
    created: float
    started: float | None = None
    finished: float | None = None


class Job:
    """One job's state, written by its thread and read by the routes."""

    def __init__(self, name: str, session: str | None):
        self.id = uuid.uuid4().hex[:16]
        self.name = name
        self.session = session
        self.status: JobStatus = "queued"
        self.done = 0
        self.total = 0
        self.message: str | None = None
        self.error: str | None = None
        self.result: Any = None
        self.created = time.time()
        self.started: float | None = None
        self.finished: float | None = None
        self.cancel_requested = False
        self.version = 0
        self._lock = threading.Lock()

    def state(self) -> JobState:
        with self._lock:
            return JobState(
                id=self.id,
                name=self.name,
                status=self.status,
                done=self.done,
                total=self.total,
                message=self.message,
                error=self.error,
                result=self.result,
                session=self.session,
                created=self.created,
                started=self.started,
                finished=self.finished,
            )

    def progress(self, done: int, total: int, message: str | None = None) -> None:
        """The job's progress callback."""
        with self._lock:
            if self.cancel_requested:
                raise JobCancelled(self.id)
            self.done, self.total = int(done), int(total)
            if message is not None:
                self.message = message
            self.version += 1

    def _set(self, status: JobStatus, **fields: Any) -> None:
        with self._lock:
            self.status = status
            for key, value in fields.items():
                setattr(self, key, value)
            self.version += 1


class JobManager:
    """Runs jobs on ``workers`` threads and keeps a finished job for ``keep`` seconds."""

    def __init__(self, *, workers: int = 4, keep: float = 600.0):
        self.keep = float(keep)
        self._pool = ThreadPoolExecutor(max_workers=int(workers), thread_name_prefix="job")
        self._jobs: dict[str, Job] = {}
        self._lock = threading.Lock()

    def submit(self, fn: Callable[[ProgressFn], Any], *, name: str = "", session: str | None = None) -> Job:
        """Start ``fn(progress)`` and return its job at once."""
        job = Job(name, session)
        with self._lock:
            self._evict()
            self._jobs[job.id] = job
        self._pool.submit(self._run, job, fn)
        return job

    def _run(self, job: Job, fn: Callable[[ProgressFn], Any]) -> None:
        if job.cancel_requested:
            job._set("cancelled", finished=time.time())
            return
        job._set("running", started=time.time())
        try:
            result = fn(job.progress)
        except JobCancelled:
            job._set("cancelled", finished=time.time())
        except Exception as exc:
            logger.exception("job %s (%s) failed", job.id, job.name)
            job._set("failed", error=f"{type(exc).__name__}: {exc}", finished=time.time())
        else:
            job._set("done", result=result, finished=time.time(), done=max(job.done, job.total))

    def get(self, job_id: str) -> Job:
        with self._lock:
            job = self._jobs.get(job_id)
        if job is None:
            raise NotFound(f"no such job: {job_id}")
        return job

    def cancel(self, job_id: str) -> JobState:
        """Ask the job to stop at its next progress call; a queued job never starts."""
        job = self.get(job_id)
        with job._lock:
            job.cancel_requested = True
            job.version += 1
        return job.state()

    def _evict(self) -> None:
        now = time.time()
        for job_id, job in list(self._jobs.items()):
            if job.finished is not None and now - job.finished > self.keep:
                del self._jobs[job_id]

    def shutdown(self) -> None:
        self._pool.shutdown(wait=False, cancel_futures=True)

    async def events(self, job: Job, *, poll: float = 0.1, ping: float = 15.0) -> AsyncIterator[str]:
        """The job's states as Server-Sent Events, one per change, ending with the final state."""
        seen = -1
        last_sent = time.monotonic()
        while True:
            if job.version != seen:
                seen = job.version
                state = job.state()
                yield f"event: {state.status}\ndata: {state.model_dump_json()}\n\n"
                last_sent = time.monotonic()
                if state.status in FINISHED:
                    return
            elif time.monotonic() - last_sent > ping:
                yield ": ping\n\n"  # keeps proxies from closing a quiet stream
                last_sent = time.monotonic()
            await asyncio.sleep(poll)

    def router(self, prefix: str = "/api/jobs") -> APIRouter:
        """The routes a page follows a job with."""
        router = APIRouter(prefix=prefix, tags=["jobs"])

        @router.get("/{job_id}", summary="The job's state")
        def job_state(job_id: str) -> JobState:
            return self.get(job_id).state()

        @router.get(
            "/{job_id}/events",
            summary="The job's states as Server-Sent Events, until it finishes",
            response_class=StreamingResponse,
            responses={
                200: {
                    "description": "event: <status>, data: the JobState as JSON; one per change",
                    "content": {"text/event-stream": {"schema": {"type": "string"}}},
                }
            },
        )
        def job_events(job_id: str) -> StreamingResponse:
            job = self.get(job_id)
            return StreamingResponse(
                self.events(job),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

        @router.delete("/{job_id}", summary="Cancel the job")
        def job_cancel(job_id: str) -> JobState:
            return self.cancel(job_id)

        return router
