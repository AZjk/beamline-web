# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""JobManager: jobs run off the request, report progress, finish or fail, and can be cancelled."""

import json
import threading
import time

import pytest

from beamline_webkit import AppInfo, JobCancelled, JobManager, create_app
from beamline_webkit.testing import client_for


def _wait(job, status, timeout=5.0):
    deadline = time.monotonic() + timeout
    while job.state().status != status:
        assert time.monotonic() < deadline, f"job stayed {job.state().status}"
        time.sleep(0.01)
    return job.state()


@pytest.fixture
def manager():
    manager = JobManager(workers=2, keep=600)
    yield manager
    manager.shutdown()


def test_a_job_reports_progress_and_its_result(manager):
    def work(progress):
        for i in range(3):
            progress(i, 3, f"step {i}")
        return {"files": ["a.hdf"]}

    job = manager.submit(work, name="fit", session="s1")
    state = _wait(job, "done")
    assert state.result == {"files": ["a.hdf"]} and state.done == 3 and state.total == 3
    assert state.message == "step 2" and state.session == "s1" and state.name == "fit"
    assert state.started is not None and state.finished is not None and state.error is None
    assert manager.get(job.id) is job


def test_a_failing_job_carries_the_error(manager):
    def work(progress):
        raise RuntimeError("h5py exploded")

    state = _wait(manager.submit(work, name="bad"), "failed")
    assert state.error == "RuntimeError: h5py exploded"


def test_cancel_stops_a_running_job_at_its_next_progress_call(manager):
    started = threading.Event()
    release = threading.Event()

    def work(progress):
        progress(0, 10)
        started.set()
        release.wait(5)
        progress(1, 10)  # raises JobCancelled

    job = manager.submit(work, name="slow")
    assert started.wait(5)
    state = manager.cancel(job.id)
    assert state.status == "running"
    release.set()
    assert _wait(job, "cancelled").status == "cancelled"
    with pytest.raises(JobCancelled):
        job.progress(2, 10)


def test_unknown_job_is_a_404(manager):
    app = create_app(AppInfo(name="t", title="t", version="0", schema_version="0.1.0"))
    app.include_router(manager.router())
    client = client_for(app)
    assert client.get("/api/jobs/nope").status_code == 404
    assert client.delete("/api/jobs/nope").json()["detail"] == "no such job: nope"


def test_routes_and_the_event_stream(manager):
    app = create_app(AppInfo(name="t", title="t", version="0", schema_version="0.1.0"))
    app.include_router(manager.router())
    gate = threading.Event()

    @app.post("/api/jobs/count", status_code=202)
    def start():
        def work(progress):
            progress(0, 2, "first")
            gate.wait(5)
            progress(1, 2, "second")
            return 42

        return manager.submit(work, name="count").state()

    client = client_for(app)
    started = client.post("/api/jobs/count")
    assert started.status_code == 202
    job_id = started.json()["id"]
    assert client.get(f"/api/jobs/{job_id}").json()["status"] in ("queued", "running")
    events = []
    with client.stream("GET", f"/api/jobs/{job_id}/events") as stream:
        for line in stream.iter_lines():
            if line.startswith("data: "):
                events.append(json.loads(line[6:]))
                if events[-1]["message"] == "first":
                    gate.set()
    assert [e["status"] for e in events][-1] == "done"
    assert events[-1]["result"] == 42 and events[-1]["done"] == 2
    assert any(e["message"] == "first" for e in events) and events[-1]["message"] == "second"
    assert client.get(f"/api/jobs/{job_id}").json()["status"] == "done"
    cancelled = client.delete(f"/api/jobs/{job_id}")
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "done", "finished jobs stay finished"


def test_queued_job_cancelled_before_it_runs():
    manager = JobManager(workers=1)
    block = threading.Event()
    manager.submit(lambda progress: block.wait(5), name="blocker")
    waiting = manager.submit(lambda progress: 1, name="waiting")
    manager.cancel(waiting.id)
    block.set()
    assert _wait(waiting, "cancelled").status == "cancelled"
    manager.shutdown()
