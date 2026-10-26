# beamline-webkit

The shared Python side of the beamline web stack. Every tool's FastAPI service (pyXpcsViewer,
gixsu, pySimpleMask) is built on it, so the three services share one set of conventions:

| What                                | Where                                                        |
| ----------------------------------- | ------------------------------------------------------------ |
| App factory with the health route   | `create_app(AppInfo(...), host=...)` → `GET /api/health`     |
| One error shape                     | raise `ServiceError` / `NotFound` → `{"detail": "..."}`      |
| Trusted-host guard from the bind IP | `trusted_hosts(bind)`, applied by `create_app`               |
| Serving under a portal prefix       | `behind_prefix(app, "/xpcs")`, or `--prefix` on the command  |
| Arrays as binary bodies             | `array_response(arr)` ↔ `decode_array(body, headers)`        |
| The serve command                   | `add_serve_arguments(parser, port=...)` + `run_server(app)`  |
| A little JSON beside a binary array | `array_response(arr, meta={...})` → the `X-Array-Meta` header   |
| Long work with progress             | `JobManager`: `submit(fn)`, `GET /api/jobs/{id}/events` (SSE)   |
| Per-browser state with a TTL        | `SessionStore` + `Depends(store.dependency())` → `Session`      |
| The committed API document          | `export_openapi(app, path)`: deterministic, schema-versioned |
| Test helpers                        | `beamline_webkit.testing`: `webkit_client`, `array_of`, …    |

Nothing here knows about q, g2, masks or scattering geometry. That is the boundary rule: each
tool keeps its Workspace, its router and its OpenAPI document.

## Install

From the monorepo, at a tag:

```sh
pip install "beamline-webkit @ git+https://github.com/AdvancedPhotonSource/beamline-web.git@webkit-py-v0.2.0#subdirectory=packages/webkit-py"
```

For development, from a checkout:

```sh
cd packages/webkit-py
uv sync --all-extras      # or: pip install -e ".[dev]"
uv run pytest
uv run ruff check . && uv run mypy
```

## A tool's service in a few lines

```python
import argparse
from beamline_webkit import AppInfo, add_serve_arguments, array_response, create_app, run_server

INFO = AppInfo(name="xpcs-viewer", title="pyXPCSViewer web", version="1.2.0", schema_version="0.1.0")


def build_app(root: str, *, host: str = "127.0.0.1"):
    app = create_app(INFO, host=host)

    @app.get("/api/files/{name}/image")
    def image(name: str):
        return array_response(workspace.image(name), dtype="float32")

    return app


def main():
    parser = argparse.ArgumentParser(prog="pyxpcsviewer-web")
    parser.add_argument("path")
    add_serve_arguments(parser, port=8070)
    args = parser.parse_args()
    run_server(build_app(args.path, host=args.host), host=args.host, port=args.port, prefix=args.prefix)
```

The binary array answer carries `X-Array-Shape: 2162,2068` and `X-Array-Dtype: f4`; the body is
the raw little-endian bytes, read in the browser by `decodeArray` from `@beamline-web/client`.
