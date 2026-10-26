# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""Arrays on the wire: raw little-endian bytes with the shape and dtype in headers.

A typed array lands in the browser as ``new Float32Array(await response.arrayBuffer())``, with
no base64 and no JSON decode; the headers say how to reshape it. :func:`array_response` builds
the answer and :func:`decode_array` reads one back (tests, Python clients). The TypeScript side
is ``decodeArray`` in the monorepo's client package.
"""

from __future__ import annotations

import json
import math
from collections.abc import Mapping
from typing import Any

import numpy as np
from fastapi.responses import Response
from numpy.typing import ArrayLike, DTypeLike, NDArray
from pydantic import BaseModel

ARRAY_MEDIA_TYPE = "application/octet-stream"
SHAPE_HEADER = "X-Array-Shape"
DTYPE_HEADER = "X-Array-Dtype"
META_HEADER = "X-Array-Meta"
META_LIMIT = 6000
"""The longest ``X-Array-Meta`` header sent, in bytes: a few hundred bytes of JSON is the
intended use (a sampling factor, an offset, a color range); anything larger belongs in a JSON
route beside the binary one, where proxies and browsers put no limit on it."""

# the dtypes a browser reads as a typed array, by NumPy name
WIRE_DTYPES: frozenset[str] = frozenset(
    {"int8", "uint8", "int16", "uint16", "int32", "uint32", "int64", "uint64", "float32", "float64"}
)


def wire_dtype(dtype: DTypeLike) -> np.dtype[Any]:
    """The little-endian dtype ``dtype`` travels as: booleans as bytes, and anything a typed array
    cannot hold (16-bit floats, objects) as 32-bit floats."""
    dt = np.dtype(dtype)
    if dt == np.bool_:
        dt = np.dtype(np.uint8)
    elif dt.name not in WIRE_DTYPES:
        dt = np.dtype(np.float32)
    return dt.newbyteorder("<")


def dtype_code(dtype: DTypeLike) -> str:
    """``"f4"`` for float32: NumPy's array-interface code without its byte-order mark."""
    return np.dtype(dtype).str.lstrip("<>|=")


def shape_header(shape: tuple[int, ...]) -> str:
    return ",".join(str(int(n)) for n in shape)


def parse_shape(text: str) -> tuple[int, ...]:
    return tuple(int(part) for part in text.split(",") if part.strip())


def _json_clean(value: Any) -> Any:
    """``value`` with NumPy scalars and arrays as Python values and non-finite numbers as None."""
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, Mapping):
        return {str(k): _json_clean(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, np.ndarray)):
        return [_json_clean(v) for v in value]
    if isinstance(value, (bool, np.bool_)):
        return bool(value)
    if isinstance(value, (int, np.integer)):
        return int(value)
    if isinstance(value, (float, np.floating)):
        number = float(value)
        return number if math.isfinite(number) else None
    return value


def meta_header(meta: Mapping[str, Any] | BaseModel) -> str:
    """``meta`` as the text of the ``X-Array-Meta`` header: compact ASCII JSON.

    Raises:
        ValueError: The text exceeds :data:`META_LIMIT`.
    """
    text = json.dumps(_json_clean(meta), separators=(",", ":"), ensure_ascii=True)
    if len(text) > META_LIMIT:
        raise ValueError(f"array meta is {len(text)} bytes, more than the {META_LIMIT} a header may carry")
    return text


def array_meta(headers: Mapping[str, str]) -> dict[str, Any] | None:
    """The ``X-Array-Meta`` of a response as a dict, None when the response carries none."""
    text = headers.get(META_HEADER)
    if text is None:
        return None
    meta: dict[str, Any] = json.loads(text)
    return meta


def array_response(
    array: ArrayLike,
    *,
    dtype: DTypeLike | None = None,
    meta: Mapping[str, Any] | BaseModel | None = None,
    headers: Mapping[str, str] | None = None,
) -> Response:
    """``array`` as a binary response.

    Args:
        array: Anything ``np.asarray`` accepts.
        dtype: The NumPy dtype to send, e.g. ``"float32"`` for a 64-bit image that is only looked
            at. By default the array's own dtype, made little-endian (:func:`wire_dtype`).
        meta: A little JSON that describes the array (a sampling factor, an offset, a color range),
            sent as the ``X-Array-Meta`` header; see :data:`META_LIMIT`.
        headers: Extra headers, e.g. a cache policy.
    """
    arr = np.asarray(array)
    arr = arr.astype(wire_dtype(arr.dtype if dtype is None else dtype), copy=False)
    if not arr.flags.c_contiguous:  # (ascontiguousarray would turn a 0-d array into a 1-d one)
        arr = np.ascontiguousarray(arr)
    sent = {SHAPE_HEADER: shape_header(arr.shape), DTYPE_HEADER: dtype_code(arr.dtype)}
    if meta is not None:
        sent[META_HEADER] = meta_header(meta)
    if headers:
        sent.update(headers)
    return Response(content=arr.tobytes(), media_type=ARRAY_MEDIA_TYPE, headers=sent)


def array_responses(description: str, *, meta: str | None = None) -> dict[int | str, dict[str, Any]]:
    """The ``responses`` of a FastAPI route that answers with :func:`array_response`, for the
    OpenAPI document: the binary body and the headers that describe it. ``meta`` names the
    schema the ``X-Array-Meta`` JSON follows, usually the model of a JSON route beside this one.

    Use with ``response_class=Response``::

        @app.get("/api/files/{name}/image/data", response_class=Response,
                 responses=array_responses("the detector image, float32 rows", meta="ImageMeta"))
    """
    headers: dict[str, Any] = {
        SHAPE_HEADER: {"description": "the array's shape, comma-separated", "schema": {"type": "string"}},
        DTYPE_HEADER: {
            "description": "the element type: f4, f8, i1, u1, i2, u2, i4, u4, i8 or u8, little-endian",
            "schema": {"type": "string"},
        },
    }
    if meta is not None:
        headers[META_HEADER] = {
            "description": f"JSON describing the array, the shape of {meta}",
            "schema": {"type": "string"},
        }
    return {
        200: {
            "description": description,
            "content": {ARRAY_MEDIA_TYPE: {"schema": {"type": "string", "format": "binary"}}},
            "headers": headers,
        }
    }


def decode_array(content: bytes, headers: Mapping[str, str]) -> NDArray[Any]:
    """The array of a response built by :func:`array_response`.

    Raises:
        ValueError: The headers are missing, or the body does not have the size they announce.
    """
    try:
        code = headers[DTYPE_HEADER]
        shape_text = headers[SHAPE_HEADER]
    except KeyError as exc:
        raise ValueError(f"not an array response: missing header {exc}") from None
    dt = np.dtype("<" + code)
    shape = parse_shape(shape_text)
    expected = int(np.prod(shape, dtype=np.int64)) * dt.itemsize
    if len(content) != expected:
        raise ValueError(f"array body has {len(content)} bytes, expected {expected} for shape {shape} {code}")
    return np.frombuffer(content, dtype=dt).reshape(shape)
