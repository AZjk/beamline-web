# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""The API document a tool commits and the frontends generate TypeScript types from.

The document is the live OpenAPI schema with ``info.version`` set to the API schema version
instead of the package version, so it only changes when the API changes, written with sorted
keys so two exports of the same API are byte-identical.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI


def openapi_document(app: FastAPI, *, schema_version: str | None = None) -> dict[str, Any]:
    """The OpenAPI document of ``app`` with ``info.version`` set to ``schema_version``, by default
    the one of the :class:`~beamline_webkit.app.AppInfo` the app was created with."""
    doc = copy.deepcopy(app.openapi())
    if schema_version is None:
        info = getattr(app.state, "info", None)
        schema_version = getattr(info, "schema_version", None)
    if schema_version is not None:
        doc["info"]["version"] = schema_version
    return doc


def openapi_text(app: FastAPI, *, schema_version: str | None = None) -> str:
    """:func:`openapi_document` as the text that is committed: 2-space indent, sorted keys, final newline."""
    doc = openapi_document(app, schema_version=schema_version)
    return json.dumps(doc, indent=2, sort_keys=True, ensure_ascii=False) + "\n"


def export_openapi(app: FastAPI, path: str | Path, *, schema_version: str | None = None) -> Path:
    """Write :func:`openapi_text` to ``path``, creating its folder, and return the path."""
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(openapi_text(app, schema_version=schema_version), encoding="utf-8")
    return target
