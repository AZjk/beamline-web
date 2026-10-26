# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""Helpers and pytest fixtures for a tool's web tests.

Installed as a pytest plugin with the package, so ``webkit_app`` and ``webkit_client`` are
available to every suite; :func:`client_for` and :func:`array_of` are plain functions.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

import numpy as np
import pytest
from fastapi import FastAPI
from numpy.typing import NDArray

from .app import AppInfo, create_app
from .arrays import ARRAY_MEDIA_TYPE, decode_array

if TYPE_CHECKING:  # httpx is a test-only dependency
    from fastapi.testclient import TestClient


def client_for(app: FastAPI, *, host: str = "localhost", raise_server_exceptions: bool = False) -> TestClient:
    """A test client that sends ``Host: localhost`` (accepted by the trusted-host guard) and, by
    default, returns a 500 answer instead of raising, so the error shape can be checked."""
    from fastapi.testclient import TestClient

    return TestClient(app, base_url=f"http://{host}", raise_server_exceptions=raise_server_exceptions)


def array_of(response: Any) -> NDArray[Any]:
    """The array of a successful binary response (:func:`~beamline_webkit.arrays.array_response`)."""
    assert response.status_code == 200, f"{response.status_code}: {response.text[:200]}"
    content_type = response.headers.get("content-type", "")
    assert content_type.startswith(ARRAY_MEDIA_TYPE), content_type
    return decode_array(response.content, response.headers)


@pytest.fixture
def webkit_app() -> FastAPI:
    """A bare application from :func:`~beamline_webkit.app.create_app`, bound to loopback."""
    return create_app(AppInfo(name="webkit-test", title="webkit test", version="0.0.0", schema_version="0.1.0"))


@pytest.fixture
def webkit_client(webkit_app: FastAPI) -> TestClient:
    return client_for(webkit_app)


__all__ = ["array_of", "client_for", "np", "webkit_app", "webkit_client"]
