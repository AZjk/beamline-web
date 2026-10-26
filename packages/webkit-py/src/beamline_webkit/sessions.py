# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""Per-browser sessions: the user state a server keeps for one page (fit results, a mask model
and its undo stack, a loaded setup file), with a time-to-live, so two users of one server never
see each other's state while the caches (open files, solvers, images) stay shared.

A page names its session with the ``X-Session-Id`` header, a token it makes up and keeps; a
client that sends none (the old pages, curl) gets a cookie. :meth:`SessionStore.dependency`
gives a route its :class:`Session`.
"""

from __future__ import annotations

import re
import secrets
import threading
import time
from collections import OrderedDict
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from fastapi import Request, Response

from .app import ServiceError

SESSION_HEADER = "X-Session-Id"
SESSION_COOKIE = "webkit_session"
_TOKEN = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def new_token() -> str:
    """A fresh session id: 32 URL-safe characters."""
    return secrets.token_urlsafe(24)


@dataclass
class Session:
    """One page's state: ``data`` is the tool's to fill, under ``lock`` when a job writes it."""

    id: str
    data: dict[str, Any] = field(default_factory=dict)
    created: float = field(default_factory=time.monotonic)
    last_seen: float = field(default_factory=time.monotonic)
    lock: threading.RLock = field(default_factory=threading.RLock, repr=False)

    def setdefault(self, key: str, factory: Callable[[], Any]) -> Any:
        """``data[key]``, created by ``factory`` on first use."""
        with self.lock:
            if key not in self.data:
                self.data[key] = factory()
            return self.data[key]


class SessionStore:
    """The sessions of a server, dropped after ``ttl`` seconds unseen or when more than
    ``max_sessions`` exist (the least recently seen first)."""

    def __init__(self, *, ttl: float = 3600.0, max_sessions: int = 64):
        self.ttl = float(ttl)
        self.max_sessions = int(max_sessions)
        self._sessions: OrderedDict[str, Session] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, session_id: str, *, create: bool = True) -> Session | None:
        """The session, created when unknown (unless ``create`` is false: then None)."""
        now = time.monotonic()
        with self._lock:
            self._expire(now)
            session = self._sessions.get(session_id)
            if session is None:
                if not create:
                    return None
                session = Session(id=session_id)
                self._sessions[session_id] = session
            session.last_seen = now
            self._sessions.move_to_end(session_id)
            while len(self._sessions) > self.max_sessions:
                self._sessions.popitem(last=False)
            return session

    def drop(self, session_id: str) -> bool:
        with self._lock:
            return self._sessions.pop(session_id, None) is not None

    def _expire(self, now: float) -> None:
        stale = [sid for sid, s in self._sessions.items() if now - s.last_seen > self.ttl]
        for sid in stale:
            del self._sessions[sid]

    def __len__(self) -> int:
        with self._lock:
            self._expire(time.monotonic())
            return len(self._sessions)

    def dependency(self) -> Callable[[Request, Response], Session]:
        """A FastAPI dependency: the session named by the ``X-Session-Id`` header or the
        ``webkit_session`` cookie, or a new one, whose cookie is set on the answer (a route that
        builds its own Response does not send that cookie: pages name their session instead)."""

        def current_session(request: Request, response: Response) -> Session:
            token = request.headers.get(SESSION_HEADER) or request.cookies.get(SESSION_COOKIE)
            if token is not None and not _TOKEN.match(token):
                raise ServiceError("session id must be 8 to 64 letters, digits, '-' or '_'")
            if token is None:
                token = new_token()
                response.set_cookie(
                    SESSION_COOKIE, token, max_age=int(self.ttl), httponly=True, samesite="lax", path="/"
                )
            session = self.get(token)
            assert session is not None
            return session

        return current_session
