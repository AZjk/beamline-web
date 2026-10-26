# Copyright © UChicago Argonne LLC
# See LICENSE file for details
"""Arrays on the wire: raw little-endian bytes with the shape and dtype in headers.

A typed array lands in the browser as ``new Float32Array(await response.arrayBuffer())``, with
no base64 and no JSON decode; the headers say how to reshape it. :func:`array_response` builds
the answer and :func:`decode_array` reads one back (tests, Python clients). The TypeScript side
is ``decodeArray`` in the monorepo's client package.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

import numpy as np
from fastapi.responses import Response
from numpy.typing import ArrayLike, DTypeLike, NDArray

ARRAY_MEDIA_TYPE = "application/octet-stream"
SHAPE_HEADER = "X-Array-Shape"
DTYPE_HEADER = "X-Array-Dtype"

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


def array_response(
    array: ArrayLike, *, dtype: DTypeLike | None = None, headers: Mapping[str, str] | None = None
) -> Response:
    """``array`` as a binary response.

    Args:
        array: Anything ``np.asarray`` accepts.
        dtype: The NumPy dtype to send, e.g. ``"float32"`` for a 64-bit image that is only looked
            at. By default the array's own dtype, made little-endian (:func:`wire_dtype`).
        headers: Extra headers, e.g. a cache policy.
    """
    arr = np.asarray(array)
    arr = arr.astype(wire_dtype(arr.dtype if dtype is None else dtype), copy=False)
    if not arr.flags.c_contiguous:  # (ascontiguousarray would turn a 0-d array into a 1-d one)
        arr = np.ascontiguousarray(arr)
    sent = {SHAPE_HEADER: shape_header(arr.shape), DTYPE_HEADER: dtype_code(arr.dtype)}
    if headers:
        sent.update(headers)
    return Response(content=arr.tobytes(), media_type=ARRAY_MEDIA_TYPE, headers=sent)


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
