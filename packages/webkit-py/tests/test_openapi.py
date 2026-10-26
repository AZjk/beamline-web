# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""export_openapi: the committed API document is deterministic and carries the schema version."""

import json

from beamline_webkit import export_openapi, openapi_document
from beamline_webkit.openapi import openapi_text


def test_document_carries_the_schema_version(webkit_app):
    doc = openapi_document(webkit_app)
    assert doc["info"]["version"] == "0.1.0"
    assert "/api/health" in doc["paths"]
    assert openapi_document(webkit_app, schema_version="2.0.0")["info"]["version"] == "2.0.0"
    assert webkit_app.openapi()["info"]["version"] == "0.0.0", "the live document is untouched"


def test_export_is_deterministic(webkit_app, tmp_path):
    first = export_openapi(webkit_app, tmp_path / "a" / "openapi.json")
    second = export_openapi(webkit_app, tmp_path / "b.json")
    text = first.read_text(encoding="utf-8")
    assert text == second.read_text(encoding="utf-8") == openapi_text(webkit_app)
    assert text.endswith("}\n")
    doc = json.loads(text)
    assert doc["openapi"].startswith("3.")
    assert list(doc) == sorted(doc)
