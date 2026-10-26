# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""The application factory: the conventions every tool's FastAPI service shares.

:func:`create_app` returns a FastAPI application with the health route, the one error shape
(``{"detail": message}``) and the trusted-host guard derived from the bind address; the tool adds
its own routes to it. :func:`behind_prefix` mounts a finished application under a URL prefix for
the per-beamline portal, where one proxy serves every tool under its own path.
"""

from __future__ import annotations

import ipaddress
import logging
from typing import Any

from fastapi import FastAPI
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

logger = logging.getLogger(__name__)

LOOPBACK_HOSTS = ("localhost", "*.localhost", "127.0.0.1", "[::1]")
HEALTH_PATH = "/api/health"


class AppInfo(BaseModel):
    """What a tool says about itself: shown on the portal's landing page, checked by its frontend."""

    name: str = Field(description="the tool's package name, e.g. xpcs-viewer")
    title: str = Field(description="the tool's display name, e.g. pyXPCSViewer web")
    version: str = Field(description="the tool's package version")
    schema_version: str = Field(
        description="the API schema version, major.minor.patch; a frontend refuses a different major"
    )


class Health(BaseModel):
    """The answer of ``GET /api/health``."""

    status: str = "ok"
    name: str
    version: str
    schema_version: str


class ServiceError(Exception):
    """An error the service reports to the browser as ``{"detail": message}`` with :attr:`status`.

    Raise it, or a subclass, from a route or from the service behind it; the handler installed by
    :func:`create_app` turns it into the answer. Subclass to change the status code.
    """

    status = 400


class NotFound(ServiceError):
    """The file, job or session named in the request does not exist."""

    status = 404


def is_loopback(host: str) -> bool:
    """True for a name or address of this machine's loopback interface."""
    name = str(host).strip().strip("[]").lower()
    if name == "localhost" or name.endswith(".localhost"):
        return True
    try:
        return ipaddress.ip_address(name).is_loopback
    except ValueError:
        return False


def trusted_hosts(bind: str = "127.0.0.1") -> list[str] | None:
    """The Host headers a server bound to ``bind`` answers to: the loopback names and ``bind``
    itself, so a page that rebinds its own name to this machine (DNS rebinding) is refused.

    None, meaning any host, when bound to every interface: it was opened to the network on
    purpose, and the portal's proxy puts its own name in front of it. This is a rebinding
    guard, not authentication: access control sits at the proxy.
    """
    if bind in ("0.0.0.0", "::", ""):
        return None
    hosts = list(LOOPBACK_HOSTS)
    if not is_loopback(bind):
        hosts.append(f"[{bind}]" if ":" in bind else bind)
    return hosts


def create_app(info: AppInfo, *, host: str = "127.0.0.1", docs: bool = True, lifespan: Any = None) -> FastAPI:
    """A FastAPI application with the shared conventions, ready for the tool's routes.

    Args:
        info: The tool's name and versions; served by ``GET /api/health``.
        host: The address the server binds to; it decides the Host headers accepted
            (:func:`trusted_hosts`).
        docs: Serve the interactive docs at ``/api/docs`` and the document at ``/api/openapi.json``.
        lifespan: FastAPI's lifespan context manager, for what to start and stop with the server
            (a job manager, a process pool).
    """
    app = FastAPI(
        title=info.title,
        version=info.version,
        docs_url="/api/docs" if docs else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if docs else None,
        lifespan=lifespan,
    )
    app.state.info = info
    hosts = trusted_hosts(host)
    if hosts is not None:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts)

    @app.exception_handler(ServiceError)
    async def _service_error(_request: Any, exc: ServiceError) -> JSONResponse:
        return JSONResponse({"detail": str(exc)}, status_code=exc.status)

    @app.exception_handler(Exception)
    async def _unexpected_error(request: Any, exc: Exception) -> JSONResponse:
        """Anything a file can throw at a reader (a missing HDF5 filter, a corrupt dataset) reaches
        the page as a message in the one error shape instead of a bare 500."""
        logger.exception("%s %s failed", request.method, request.url.path)
        return JSONResponse({"detail": f"{type(exc).__name__}: {exc}"}, status_code=500)

    @app.get(HEALTH_PATH, response_model=Health, tags=["service"], summary="Liveness and versions")
    def health() -> Health:
        return Health(name=info.name, version=info.version, schema_version=info.schema_version)

    return app


def normalize_prefix(prefix: str) -> str:
    """``"xpcs/"`` becomes ``"/xpcs"``; an empty prefix or ``"/"`` becomes ``""``."""
    path = "/" + prefix.strip().strip("/")
    return "" if path == "/" else path


def behind_prefix(app: FastAPI, prefix: str) -> FastAPI:
    """``app`` served under ``prefix`` (``/xpcs``) the way the portal's proxy forwards it: the prefix
    stays in the path, ``/`` redirects to it, and the application sees the prefix as its root path
    so its docs and links are right. Without a prefix the application is returned as is."""
    prefix = normalize_prefix(prefix)
    if not prefix:
        return app
    outer = FastAPI(openapi_url=None, docs_url=None, redoc_url=None)

    @outer.get("/", include_in_schema=False)
    def _to_prefix() -> RedirectResponse:
        return RedirectResponse(prefix + "/")

    outer.mount(prefix, app)
    return outer
