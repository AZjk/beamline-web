# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""array_response and decode_array: the binary wire format, both directions."""

import numpy as np
import pytest

from beamline_webkit import array_response, decode_array
from beamline_webkit.arrays import DTYPE_HEADER, SHAPE_HEADER, dtype_code, wire_dtype
from beamline_webkit.testing import array_of, client_for


@pytest.mark.parametrize(
    "array",
    [
        np.arange(6, dtype=np.float32).reshape(2, 3),
        np.arange(24, dtype=np.int64).reshape(2, 3, 4),
        np.array(3.5),
        np.zeros((0, 4), dtype=np.uint16),
        np.linspace(0, 1, 5, dtype=np.float64),
    ],
    ids=["f4 2d", "i8 3d", "0-d", "empty", "f8 1d"],
)
def test_roundtrip(array):
    answer = array_response(array)
    out = decode_array(answer.body, answer.headers)
    assert out.dtype == array.dtype
    assert out.shape == array.shape
    assert np.array_equal(out, array)
    assert answer.media_type == "application/octet-stream"


def test_bool_and_unsupported_dtypes_are_converted():
    answer = array_response(np.array([True, False]))
    assert answer.headers[DTYPE_HEADER] == "u1"
    assert decode_array(answer.body, answer.headers).tolist() == [1, 0]
    assert array_response(np.array([1.5], dtype=np.float16)).headers[DTYPE_HEADER] == "f4"


def test_big_endian_input_is_sent_little_endian():
    answer = array_response(np.array([1, 2, 3], dtype=">i4"))
    assert answer.headers[DTYPE_HEADER] == "i4"
    assert answer.body == np.array([1, 2, 3], dtype="<i4").tobytes()


def test_requested_dtype_and_extra_headers():
    answer = array_response(np.arange(4, dtype=np.float64), dtype="float32", headers={"Cache-Control": "no-store"})
    assert answer.headers[DTYPE_HEADER] == "f4"
    assert answer.headers[SHAPE_HEADER] == "4"
    assert answer.headers["cache-control"] == "no-store"
    assert len(answer.body) == 16


def test_decode_checks_headers_and_length():
    with pytest.raises(ValueError, match="expected 8"):
        decode_array(b"\x00" * 7, {DTYPE_HEADER: "f4", SHAPE_HEADER: "2"})
    with pytest.raises(ValueError, match="missing header"):
        decode_array(b"", {})


def test_codes():
    assert dtype_code(np.uint8) == "u1"
    assert dtype_code(">f8") == "f8"
    assert wire_dtype(bool) == np.dtype("u1")
    assert wire_dtype(">i2") == np.dtype("<i2")


def test_array_route(webkit_app):
    @webkit_app.get("/api/arr")
    def arr():
        return array_response(np.full((3, 2), 7, dtype=np.int16))

    out = array_of(client_for(webkit_app).get("/api/arr"))
    assert out.shape == (3, 2)
    assert out.dtype == np.int16
    assert out[0, 0] == 7


def test_meta_travels_in_a_header(webkit_app):
    from pydantic import BaseModel

    from beamline_webkit import array_meta, array_responses
    from beamline_webkit.arrays import META_HEADER, META_LIMIT, meta_header
    from beamline_webkit.testing import meta_of

    class Meta(BaseModel):
        factor: int
        zmin: float

    @webkit_app.get("/api/with-dict")
    def with_dict():
        meta = {
            "factor": np.int64(3),
            "x0": np.float32(1.0),
            "nan": float("nan"),
            "label": "q=0.1 Å⁻¹",
            "ok": np.bool_(True),
        }
        return array_response(np.zeros((2, 2), dtype=np.float32), meta=meta)

    @webkit_app.get("/api/with-model")
    def with_model():
        return array_response(np.zeros(3, dtype=np.uint8), meta=Meta(factor=2, zmin=0.5))

    @webkit_app.get("/api/without")
    def without():
        return array_response(np.zeros(3, dtype=np.uint8))

    client = client_for(webkit_app)
    answer = client.get("/api/with-dict")
    assert answer.headers[META_HEADER].isascii()
    assert meta_of(answer) == {"factor": 3, "x0": 1.0, "nan": None, "label": "q=0.1 Å⁻¹", "ok": True}
    assert array_of(answer).shape == (2, 2)
    assert meta_of(client.get("/api/with-model")) == {"factor": 2, "zmin": 0.5}
    assert meta_of(client.get("/api/without")) is None
    assert array_meta({}) is None
    with pytest.raises(ValueError, match="bytes"):
        meta_header({"big": "x" * META_LIMIT})
    responses = array_responses("an image", meta="ImageMeta")
    assert "ImageMeta" in responses[200]["headers"][META_HEADER]["description"]
    assert "application/octet-stream" in responses[200]["content"]
