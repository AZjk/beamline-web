# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""The serve command: the shared arguments, the shown URL, and the prefix applied at run time."""

import argparse

import beamline_webkit.serve as serve_module
from beamline_webkit import AppInfo, add_serve_arguments, create_app, run_server, serve_url
from beamline_webkit.testing import client_for


def test_serve_url():
    assert serve_url("127.0.0.1", 8070) == "http://127.0.0.1:8070/"
    assert serve_url("0.0.0.0", 8070, "xpcs") == "http://127.0.0.1:8070/xpcs/"
    assert serve_url("::1", 80) == "http://[::1]:80/"


def test_serve_arguments():
    parser = argparse.ArgumentParser()
    add_serve_arguments(parser, port=8070)
    args = parser.parse_args([])
    assert (args.host, args.port, args.prefix, args.open, args.log_level) == ("127.0.0.1", 8070, "", False, "info")
    args = parser.parse_args(
        ["--host", "0.0.0.0", "--port", "9000", "--prefix", "/x", "--open", "--log-level", "debug"]
    )
    assert (args.host, args.port, args.prefix, args.open, args.log_level) == ("0.0.0.0", 9000, "/x", True, "debug")


def test_run_server_applies_the_prefix(monkeypatch):
    seen = {}
    monkeypatch.setattr(serve_module, "_uvicorn_run", lambda app, **kw: seen.update(app=app, **kw))
    app = create_app(AppInfo(name="t", title="t", version="0", schema_version="0.1.0"))
    run_server(app, host="0.0.0.0", port=1234, prefix="/t", log_level="warning")
    assert (seen["host"], seen["port"], seen["log_level"]) == ("0.0.0.0", 1234, "warning")
    assert seen["app"] is not app
    assert client_for(seen["app"]).get("/t/api/health").status_code == 200
    run_server(app, port=1234)
    assert seen["app"] is app
