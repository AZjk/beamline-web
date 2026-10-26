# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""The serve command every tool's ``<tool>-web`` entry point is built on: the shared arguments
(:func:`add_serve_arguments`) and the run (:func:`run_server`), with the URL prefix of the portal
applied here so the application itself never knows about it."""

from __future__ import annotations

import argparse
import threading
import webbrowser
from typing import Any

from fastapi import FastAPI

from .app import behind_prefix, normalize_prefix

LOG_LEVELS = ("critical", "error", "warning", "info", "debug")


def add_serve_arguments(parser: argparse.ArgumentParser, *, port: int) -> None:
    """Add ``--host``, ``--port``, ``--prefix``, ``--open`` and ``--log-level`` to ``parser``."""
    parser.add_argument(
        "--host", default="127.0.0.1", help="address to listen on (default 127.0.0.1; 0.0.0.0 opens it to the network)"
    )
    parser.add_argument("--port", type=int, default=port, help=f"port (default {port})")
    parser.add_argument(
        "--prefix",
        default="",
        help="URL prefix the app is served under behind the portal's proxy, e.g. /xpcs (default: none)",
    )
    parser.add_argument("--open", action="store_true", help="open the page in a browser once the server is up")
    parser.add_argument("--log-level", default="info", choices=LOG_LEVELS)


def serve_url(host: str, port: int, prefix: str = "") -> str:
    """The address to open in a browser for a server bound to ``host``."""
    shown = "127.0.0.1" if host in ("0.0.0.0", "::", "") else host
    if ":" in shown and not shown.startswith("["):
        shown = f"[{shown}]"
    return f"http://{shown}:{port}{normalize_prefix(prefix)}/"


def _uvicorn_run(app: FastAPI, **kwargs: Any) -> None:  # separate so tests can replace it
    import uvicorn

    uvicorn.run(app, **kwargs)


def run_server(
    app: FastAPI,
    *,
    host: str = "127.0.0.1",
    port: int,
    prefix: str = "",
    log_level: str = "info",
    open_browser: bool = False,
) -> None:
    """Serve ``app`` with uvicorn, under ``prefix`` when one is given, until interrupted."""
    url = serve_url(host, port, prefix)
    if open_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    _uvicorn_run(behind_prefix(app, prefix), host=host, port=port, log_level=log_level)
