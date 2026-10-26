# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""The shared Python side of the beamline web stack.

Every tool's FastAPI service is built on this package: :func:`create_app` gives the application
with the health route, the one error shape and the trusted-host guard; :func:`array_response`
sends arrays as raw little-endian bytes; :func:`run_server` and :func:`add_serve_arguments` are the
serve command; :func:`export_openapi` writes the API document the frontends generate types from;
and :mod:`beamline_webkit.testing` holds the pytest fixtures.

Nothing here knows about q, g2, masks or scattering geometry: that stays in the tools.
"""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("beamline-webkit")
except PackageNotFoundError:  # pragma: no cover - running from a source tree without an install
    __version__ = "0.0.0"

from .app import AppInfo, Health, NotFound, ServiceError, behind_prefix, create_app, trusted_hosts
from .arrays import ARRAY_MEDIA_TYPE, array_response, decode_array
from .openapi import export_openapi, openapi_document
from .serve import add_serve_arguments, run_server, serve_url

__all__ = [
    "ARRAY_MEDIA_TYPE",
    "AppInfo",
    "Health",
    "NotFound",
    "ServiceError",
    "__version__",
    "add_serve_arguments",
    "array_response",
    "behind_prefix",
    "create_app",
    "decode_array",
    "export_openapi",
    "openapi_document",
    "run_server",
    "serve_url",
    "trusted_hosts",
]
