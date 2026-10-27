# Developer guide

How the pieces fit, and how to add to them. The [README](../README.md) has the decisions, the
layout and the release flow.

## The shape of an app

An app (`apps/<tool>`) is a Vite + React page built from the kit:

- `src/api/`: the tool's committed OpenAPI document (`openapi.json`), the types generated from
  it (`schema.d.ts`, by `pnpm gen:types`), the typed client (`client.ts`) and one query hook per
  route (`queries.ts`). Binary routes go through `fetchArray` from `@beamline-web/client`.
- `src/store.ts`: the shared slice of the kit (`sharedSlice`: the file shown, the files checked,
  the tab, and the slots plugins exchange) plus what the app's tabs share.
- `src/plugins.tsx`: the tabs and panels, registered with the kit's `PluginRegistry`; the shell
  places them by `placement` (`tab`, `panel`, `side`).
- `src/App.tsx`: the shell composition, the URL state, the keyboard shortcuts.

The kit knows nothing of the science: `@beamline-web/ui` is the shell, the file browser, the
metadata card, the tree and the store slice; `@beamline-web/viz` draws arrays (`ArrayImage`,
`DetectorImage`) and Plotly figures (`Plot`, `g2Figure`) from plain numbers; `@beamline-web/client`
talks to a service built on `beamline_webkit`. `@beamline-web/viz` also holds the shape editor
of the [mask-editor spike](spikes/mask-editor.md), the base of ROI and mask tools.

## Adding a plugin (a tab or a panel)

1. Write a component taking `PluginProps` (`visible`): fetch only while visible, read inputs from
   the store, keep settings with `useLocalState`.
2. Register it in `src/plugins.tsx` with an id, a label, a placement and an order; name the
   plugins it depends on in `dependsOn` (the registry checks they exist).
3. A tab that is hidden while its inputs change shows a dot: list its inputs in the app's
   `useStale` call.

## Adding an endpoint

1. In the tool: a method on its Workspace (no web framework there), a route in `web/app.py`
   with a response model in `web/models.py`; a binary route uses `array_response` and
   `array_responses` from `beamline_webkit`, with a `/meta` route beside it that types the
   `X-Array-Meta` JSON.
2. Regenerate the tool's document (`pyxpcsviewer-web --export-openapi src/pyxpcsviewer/web/openapi.json`);
   its test suite fails while the committed copy is stale. Bump the API schema version
   (`API_SCHEMA_VERSION`): the minor for an addition, the major for a change a page would not survive.
3. In the app: copy the document to `apps/<tool>/openapi.json`, run `pnpm gen:types`, commit both;
   CI fails when the generated types drift. Add a hook in `src/api/queries.ts`.

## Long work

A route that takes more than a second starts a job (`JobManager.submit` in the tool, which
answers with the job's state) and the page follows it with `runJob` from `@beamline-web/client`,
showing `done / total` in the message bar; the result lands in the page's session on the server
(`SessionStore`) so two browsers never see each other's results.

## Adding a tool

1. The tool repository gains a Workspace, a FastAPI router built on `beamline_webkit.create_app`,
   a `[gui]` extra for its Qt and a `[web]` extra on `beamline-webkit`, the export command and
   the committed document, and CI running pytest with and without Qt.
2. Here: `apps/<tool>` on the template of `apps/xpcs` (or `apps/gixs`, which has tools with
   result-over-controls tabs, jobs with progress, an editable table and box ROIs on the image), a `<tool>-v*` tag pattern in
   `release-app.yml`, and a job in `ci.yml` that runs its Playwright flow over the service on
   synthetic data.

## Checks

`pnpm check` runs lint, format, typecheck, unit tests and the builds; `pnpm e2e` the Playwright
flow against the built app; `XPCS_URL=http://host:port pnpm --filter @beamline-web/app-xpcs exec
playwright test e2e/real-data.spec.ts` the flow over a running service. `pnpm storybook` shows
the kit's components on synthetic data.
