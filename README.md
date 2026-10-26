# beamline-web

One repository for the web frontends of **pyXpcsViewer**, **gixsu** and **pySimpleMask**, the
TypeScript kit they are built from, and the shared Python package their FastAPI services are built
on. It is the web half of the [Beamline Web Stack Migration Plan](https://claude.ai/artifact/5uaWRFxpBa5b7KoLZpjbcz);
the tool repositories stay Python libraries and gain a thin typed router each.

**Status: Phase 0, Foundations.** Started 2026-10-26. The exit criteria are at the bottom.

## Decisions

Locked in Phase 0 and accepted on 2026-10-26. Every later phase builds on them; changing one is
a pull request against this table.

| Decision             | What was decided                                                                                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User state           | Caches stay shared on the server: open files, solvers, images. User state moves to the browser where small, or to a per-session server store with a time-to-live where large: the mask model and its undo stack, fit results, the loaded setup file.        |
| Array wire format    | Binary body, little-endian, with `X-Array-Shape` and `X-Array-Dtype` headers. Two detail levels: a preview capped near 1024 px, and a full-resolution fetch of the visible region. Implemented by `array_response` (Python) and `decodeArray` (TypeScript). |
| ROI JSON format      | One schema for all tools, derived from gixsu's linecut config and pySimpleMask's ROI rows: `id`, `kind`, coordinates in data units, inclusive or exclusive, `group`, `mirror`, `enabled`.                                                                   |
| API conventions      | Resource paths per file; one error shape, `{"detail": "..."}`, for every status; binary endpoints beside the JSON ones; a schema version in the info route; no strings for null ranges. `create_app` installs the error shape and the health route.         |
| Colormaps            | One named list, rendered client-side, names matching the Qt GUIs: viridis, inferno, magma, plasma, cividis, turbo, hot, gray, jet.                                                                                                                          |
| Plugin interface     | gixsu's tool contract generalized: `id`, `label`, `placement`, `panel`, `result`, a dependency list, and shared store slices for the active file, checked files, processing options, overrides, ROIs, fit result and overlays.                              |
| Where frontends live | This monorepo for now, one folder per app. Once the kit stabilizes an app folder can move into its tool repository; apps import the kit only through package entry points so that move stays mechanical.                                                    |

## Layout

```
beamline-web/                    one repo, pnpm workspaces
  packages/webkit-py/            shared Python: app factory, binary arrays, serve command, OpenAPI export, pytest fixtures
  packages/ui/                   tokens, shell, panes, file browser, metadata tree, forms, plugin registry
  packages/viz/                  detector image, readout, overlays, ROI and mask editor, plot wrapper, colormaps
  packages/client/               generated-type tooling, binary fetch, query hooks, job client, error model
  apps/xpcs/  apps/gixs/  apps/mask/   one Vite app per tool: tabs and panels only

pyXpcsViewer/  gixsu/  pySimpleMask/    tool repos stay Python libraries
  src/<tool>/core/               unchanged
  src/<tool>/workspace.py        the service, the only API boundary
  src/<tool>/web/routes.py       thin FastAPI router over Workspace, pydantic models
  src/<tool>/web/openapi.json    the committed API document, exported by the tool's command
  src/<tool>/web/static/         built frontend, gitignored, filled by the release workflow
  src/<tool>/gui/                Qt, moved to a [gui] extra
```

**Boundary rule:** if it knows about q, g2, masks or GIXS geometry, it is not in the kit. Each
Workspace, each router, each app's tabs, and each app's OpenAPI document and generated types
stay with the tool.

## Getting started

Node 22.12 or newer and [uv](https://docs.astral.sh/uv/). pnpm comes from the `packageManager`
field:

```sh
corepack enable pnpm
pnpm install
pnpm check                 # lint, format check, typecheck, unit tests, build of every package
pnpm gen:types             # apps/*/openapi.json -> apps/*/src/api/schema.d.ts
pnpm storybook             # the stories of packages/viz
pnpm --filter @beamline-web/app-xpcs exec playwright install chromium   # once
pnpm e2e                   # Playwright, against the built app
pnpm --filter @beamline-web/app-xpcs dev   # the app at http://localhost:5173, /api proxied to pyxpcsviewer-web on :8070
```

The Python package:

```sh
cd packages/webkit-py
uv sync --all-extras
uv run pytest
uv run ruff check . && uv run ruff format --check . && uv run mypy
```

## Keeping the frontend and the API in step

1. A change to a tool's routes regenerates the tool's committed document in the same pull
   request. For pyXpcsViewer: `pyxpcsviewer-web --export-openapi src/pyxpcsviewer/web/openapi.json`;
   its test suite fails while the copy is stale.
2. The app pins the tool it targets in its `package.json` (`tool`: name, repository, ref, document).
   Copy the tool's document to `apps/<app>/openapi.json`, run `pnpm gen:types`, commit both.
3. CI regenerates the types and fails when `src/api/schema.d.ts` differs from what is committed.
4. The document's `info.version` is the API schema version, not the package version, so it only
   changes when the API does. The frontend refuses a different major version (Phase 1).

## Releasing the shared Python package

Tag the monorepo as `webkit-py-vX.Y.Z` after bumping `packages/webkit-py/pyproject.toml`. Until it
is on PyPI, tools install it from the tag:

```sh
pip install "beamline-webkit @ git+https://github.com/AdvancedPhotonSource/beamline-web.git@webkit-py-v0.2.0#subdirectory=packages/webkit-py"
```

The tool repositories' CI workflows carry that line as `WEBKIT_SPEC`.

## Phase 0 exit criteria

- [x] Decision table accepted and recorded here.
- [x] The monorepo builds an empty app (`apps/xpcs`) and runs its tests in CI.
- [x] The shared Python package installs from a git tag and serves a health route behind a prefix.
- [x] pytest runs in CI for pyXpcsViewer, gixsu and pySimpleMask.
- [x] `pip install` of any tool without the `gui` extra pulls no Qt.
