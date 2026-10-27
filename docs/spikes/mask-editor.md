# Spike: a mask editor on H5Web's data layer

The plan's one technical risk ("mask editor harder than estimated") asked for a prototype of
polygon and ellipse drawing on H5Web's data layer before Phase 3 is committed. This is it:
`packages/viz/src/shapes/`, shown by the story _viz / Mask editor spike_.

## What was built

- **Shapes in data coordinates** (`types.ts`): a polygon (vertices) and an axis-aligned
  ellipse (center, semi-axes), each with an id. The JSON of a shape list is the ROI wire
  format of the decision table.
- **Geometry** (`geometry.ts`, unit-tested): point-in-shape, handles, moving a handle or a
  shape, and `rasterize`, a scanline fill that marks the pixels whose center a shape covers.
  A full Eiger-size frame (2162 × 2068) with a 12-gon and an ellipse rasterizes in about 2 to
  5 ms; 200 ellipses in 3 ms. The pixel rule is "center inside, `left <= x < right` along a
  scanline"; a server rasterizing the same JSON must apply the same rule, so it goes into the
  API conventions with the ROI schema.
- **The editor** (`ShapeEditor.tsx`): a child of `ArrayImage`. Polygon: click the vertices,
  close on the first one, with Enter or a double-click; Escape drops it. Ellipse: drag from the
  center. Select: click a shape, drag its handles or its body; Delete removes it. Shapes are SVG
  over the canvas and follow pan and zoom; the hit tests run in html pixels, so a handle is as
  easy to grab at any zoom.
- **The mask preview** (`MaskMesh.tsx`): the rasterized mask tinted over the image on the GPU,
  through the kit's new `OverlayMesh` (below).

Verified headlessly over the story (pixels read back from the WebGL buffer, since headless
screenshots of the canvas are unreliable): the mask tints the image where the shapes are, the
image stays visible elsewhere; draw a polygon and an ellipse, drag a handle (the ellipse's
semi-axis grows), delete, select by a click, move by a drag, deselect by a click on empty space,
and the shapes keep their place through a wheel zoom.

## What H5Web gives, and the rules it imposes

- `useCanvasEvent` hands every pointer event with its data and html coordinates; the SVG
  overlay sits under the canvas for events, so all hit testing is the editor's own.
- `DataToHtml` converts data points to html pixels, inside the canvas tree; `SvgElement`
  portals SVG into the overlay. The order is fixed: converter outside, portal inside, or
  H5Web's hooks throw ("Hooks can only be used within the Canvas"). The beam-center marker
  ran into the same rule.
- The editor and the pan interaction compete for the left button. H5Web resolves conflicts
  by modifier keys only, so `editorInteractions` turns the pan off while a tool draws or a
  shape is selected (a drag then edits), and back on once the selection is cleared.
  `ArrayImage` gained an `interactions` prop for that.
- **`HeatmapMesh` cannot stack.** Its material never blends: a second one over the image
  replaces it, alpha included, so the image under a per-pixel-alpha overlay vanished (the
  readback showed the overlay's colors with alpha 0, in Chromium and in Firefox alike). The
  q-bin label overlay of the detector image, built that way in Phase 1, had the same defect.
  The kit now has `OverlayMesh`: H5Web's `VisMesh` plane with a blending shader material of
  its own, drawn after the image, taking a label or mask array, a palette, an opacity and a
  highlighted label. The label overlay and the mask preview both use it.

## Decisions this settles

- **Client-side rasterization: yes, for the preview.** It is a few milliseconds, so the mask
  updates live with every drag and never waits for the server. The shape JSON stays the source
  of truth; the server rasterizes the same JSON for the mask it writes (NumPy, same rule), and
  the client never uploads pixels.
- **One editor for the kit.** The spike's `ShapeEditor` is the base of Phase 3's mask editor
  and of Phase 2's box ROI tool; the shapes to add are rectangles, circles (an ellipse with
  one radius), lines, and rings, each a `kind` with its handles and its `fillShape` case.

## What is left for Phase 3

Rotation of ellipses and rectangles, the remaining kinds, include and exclude per shape, an
undo stack, keyboard nudging, snapping to pixel edges, a shape list with editable numbers, and
the per-session mask model on the server. None of it touches H5Web; the estimate of 10 to 14
weeks for Phase 3 stands, and this spike retires the risk.
