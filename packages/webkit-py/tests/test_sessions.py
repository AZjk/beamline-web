# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""SessionStore: per-browser state by header or cookie, dropped after its time-to-live."""

import time

from fastapi import Depends

from beamline_webkit import AppInfo, Session, SessionStore, create_app
from beamline_webkit.sessions import SESSION_COOKIE, SESSION_HEADER
from beamline_webkit.testing import client_for


def test_store_creates_touches_and_expires(monkeypatch):
    store = SessionStore(ttl=10, max_sessions=2)
    a = store.get("session-a")
    assert a is not None and a.id == "session-a" and len(store) == 1
    assert store.get("session-a") is a
    assert store.get("unknown", create=False) is None
    assert a.setdefault("fits", dict) is a.setdefault("fits", dict)
    store.get("session-b")
    store.get("session-c")
    assert len(store) == 2 and store.get("session-a", create=False) is None, "the least recently seen is dropped"
    clock = time.monotonic()
    monkeypatch.setattr(time, "monotonic", lambda: clock + 11)
    assert len(store) == 0, "unseen for longer than the ttl"
    assert store.drop("session-b") is False


def _app_with_sessions():
    app = create_app(AppInfo(name="t", title="t", version="0", schema_version="0.1.0"))
    store = SessionStore(ttl=60)
    current = store.dependency()

    @app.get("/api/whoami")
    def whoami(session: Session = Depends(current)):  # noqa: B008
        session.data["hits"] = session.data.get("hits", 0) + 1
        return {"id": session.id, "hits": session.data["hits"]}

    return app, store


def test_header_names_the_session():
    app, store = _app_with_sessions()
    client = client_for(app)
    first = client.get("/api/whoami", headers={SESSION_HEADER: "page-token-1"}).json()
    second = client.get("/api/whoami", headers={SESSION_HEADER: "page-token-1"}).json()
    other = client.get("/api/whoami", headers={SESSION_HEADER: "page-token-2"}).json()
    assert (first["id"], first["hits"], second["hits"], other["hits"]) == ("page-token-1", 1, 2, 1)
    assert len(store) == 2
    assert client.get("/api/whoami", headers={SESSION_HEADER: "bad token!"}).status_code == 400


def test_cookie_for_a_client_without_a_header():
    app, _store = _app_with_sessions()
    client = client_for(app)
    answer = client.get("/api/whoami")
    token = answer.cookies[SESSION_COOKIE]
    assert answer.json()["id"] == token and len(token) >= 8
    assert client.get("/api/whoami").json() == {"id": token, "hits": 2}, "the cookie is sent back"
