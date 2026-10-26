# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""create_app: the health route, the prefix, the host guard and the one error shape."""

from beamline_webkit import AppInfo, NotFound, ServiceError, behind_prefix, create_app, trusted_hosts
from beamline_webkit.testing import client_for

INFO = AppInfo(name="demo", title="Demo", version="1.2.3", schema_version="0.1.0")


def test_health_route(webkit_client):
    answer = webkit_client.get("/api/health")
    assert answer.status_code == 200
    assert answer.json() == {"status": "ok", "name": "webkit-test", "version": "0.0.0", "schema_version": "0.1.0"}


def test_health_behind_a_prefix():
    client = client_for(behind_prefix(create_app(INFO), "xpcs/"))
    assert client.get("/xpcs/api/health").json()["name"] == "demo"
    assert client.get("/api/health").status_code == 404
    assert client.get("/", follow_redirects=False).headers["location"] == "/xpcs/"
    # the mounted application knows its root path, so its own document and docs live under the prefix
    assert client.get("/xpcs/api/openapi.json").json()["info"]["title"] == "Demo"
    assert client.get("/xpcs/api/docs").status_code == 200


def test_no_prefix_returns_the_app_itself():
    app = create_app(INFO)
    assert behind_prefix(app, "") is app
    assert behind_prefix(app, "/") is app


def test_trusted_hosts():
    assert trusted_hosts("0.0.0.0") is None
    assert trusted_hosts("::") is None
    assert "localhost" in trusted_hosts("127.0.0.1")
    assert "10.0.0.5" not in trusted_hosts("127.0.0.1")
    assert "10.0.0.5" in trusted_hosts("10.0.0.5")
    assert "[fe80::1]" in trusted_hosts("fe80::1")


def test_host_header_is_checked_when_bound_to_loopback():
    client = client_for(create_app(INFO, host="127.0.0.1"))
    assert client.get("/api/health", headers={"Host": "evil.example.com"}).status_code == 400
    assert client.get("/api/health", headers={"Host": "localhost"}).status_code == 200
    open_client = client_for(create_app(INFO, host="0.0.0.0"))
    assert open_client.get("/api/health", headers={"Host": "beamline.example.gov"}).status_code == 200


def test_errors_have_one_shape():
    app = create_app(INFO)

    @app.get("/api/bad")
    def bad():
        raise ServiceError("no such thing")

    @app.get("/api/missing")
    def missing():
        raise NotFound("no such file: x.hdf")

    @app.get("/api/boom")
    def boom():
        raise RuntimeError("h5py exploded")

    @app.get("/api/count")
    def count(n: int):
        return {"n": n}

    client = client_for(app)
    bad_answer = client.get("/api/bad")
    assert bad_answer.status_code == 400 and bad_answer.json() == {"detail": "no such thing"}
    assert client.get("/api/missing").status_code == 404
    boom_answer = client.get("/api/boom")
    assert boom_answer.status_code == 500 and boom_answer.json() == {"detail": "RuntimeError: h5py exploded"}
    # FastAPI's own validation errors carry the same key
    assert "detail" in client.get("/api/count", params={"n": "x"}).json()
    assert client.get("/api/count", params={"n": "3"}).json() == {"n": 3}


def test_docs_can_be_turned_off():
    client = client_for(create_app(INFO, docs=False))
    assert client.get("/api/openapi.json").status_code == 404
    assert client.get("/api/health").status_code == 200
