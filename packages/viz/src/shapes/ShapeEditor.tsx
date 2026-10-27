// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * Drawing and editing shapes over an array, on H5Web's data layer: the shapes are SVG in data
 * coordinates (they follow pan and zoom), the pointer events come from the canvas with their
 * data and html coordinates, and hit tests run in html pixels so a handle is as easy to grab
 * at any zoom. Rendered inside the canvas (a child of ArrayImage).
 *
 * Polygon: click the vertices; close on the first one, with Enter or a double-click; Escape
 * drops it. Ellipse: drag from the center. Select: click a shape, drag its handles or its body;
 * Delete removes it, Escape deselects. The pan interaction must be off while a tool is active
 * or a shape is selected: `editorInteractions` (interactions.ts) gives ArrayImage that configuration.
 */

import { DataToHtml, SvgElement, useCanvasEvent, useVisCanvasContext } from "@h5web/lib";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";

import { handlesOf, pointInShape, translated, withHandleAt } from "./geometry";
import type { Point, Shape, ShapeTool } from "./types";

/** Html pixels within which a handle, or the first vertex, is hit. */
const GRAB = 8;
const STROKE = "var(--color-accent, #d97706)";
const SELECTED = "var(--color-danger, #dc2626)";
const FILL = "rgba(217, 119, 6, 0.12)";

export interface ShapeEditorProps {
  tool: ShapeTool;
  shapes: Shape[];
  onChange: (shapes: Shape[]) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** A drawing tool finished a shape (an app usually returns to the select tool). */
  onDrawn?: (shape: Shape) => void;
  newId?: () => string;
}

const defaultId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const v3 = (p: Point) => new Vector3(p.x, p.y, 0);

const near = (a: Vector3, b: Vector3) => Math.hypot(a.x - b.x, a.y - b.y) <= GRAB;

/** Consecutive duplicate vertices (a double-click's) dropped. */
function cleaned(points: Point[]): Point[] {
  return points.filter(
    (p, i) => i === 0 || Math.hypot(p.x - points[i - 1]!.x, p.y - points[i - 1]!.y) > 1e-9,
  );
}

type Drag = { id: string; handle: number | "move" | "draw"; last: Point };

export function ShapeEditor({
  tool,
  shapes,
  onChange,
  selectedId,
  onSelect,
  onDrawn,
  newId = defaultId,
}: ShapeEditorProps) {
  const camera = useThree((state) => state.camera);
  const { dataToHtml } = useVisCanvasContext();
  const [draft, setDraftState] = useState<Shape | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const drag = useRef<Drag | null>(null);
  const selected = shapes.find((s) => s.id === selectedId) ?? null;

  // the canvas listeners read the latest props and state through refs: the draft is kept in
  // one of its own so that clicks faster than a render still build one polygon
  const draftRef = useRef<Shape | null>(null);
  const setDraft = (update: Shape | null | ((current: Shape | null) => Shape | null)) => {
    draftRef.current = typeof update === "function" ? update(draftRef.current) : update;
    setDraftState(draftRef.current);
  };
  const latest = useRef({ tool, shapes, selected, selectedId, onChange, onSelect, onDrawn });
  latest.current = { tool, shapes, selected, selectedId, onChange, onSelect, onDrawn };
  const toHtml = (p: Point) => dataToHtml(camera, v3(p));

  const commit = (shape: Shape) => {
    const { shapes: current, onChange: change, onSelect: select, onDrawn: drawn } = latest.current;
    change([...current, shape]);
    select(shape.id);
    drawn?.(shape);
    setDraft(null);
    setCursor(null);
  };

  const closePolygon = () => {
    const current = draftRef.current;
    if (!current || current.kind !== "polygon") return;
    const points = cleaned(current.points);
    if (points.length >= 3) commit({ ...current, points });
    else {
      setDraft(null);
      setCursor(null);
    }
  };

  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    const current = draftRef.current;
    if (d?.handle !== "draw" || !current || current.kind !== "ellipse") return;
    if (current.rx > 0 && current.ry > 0) commit(current);
    else setDraft(null);
  };

  // a tool change drops the draft
  useEffect(() => {
    setDraft(null);
    setCursor(null);
    drag.current = null;
  }, [tool]);

  useCanvasEvent("pointerdown", (event) => {
    const source = event.sourceEvent;
    if (source.button !== 0 || source.ctrlKey) return;
    const { tool: active, shapes: current, selected: chosen, onSelect: select } = latest.current;
    const p = { x: event.dataPt.x, y: event.dataPt.y };
    if (active === "ellipse") {
      const shape: Shape = { id: newId(), kind: "ellipse", cx: p.x, cy: p.y, rx: 0, ry: 0 };
      setDraft(shape);
      drag.current = { id: shape.id, handle: "draw", last: p };
      return;
    }
    if (active !== "select") return;
    if (chosen) {
      const handle = handlesOf(chosen).findIndex((h) => near(toHtml(h), event.htmlPt));
      if (handle >= 0) {
        drag.current = { id: chosen.id, handle, last: p };
        return;
      }
      if (pointInShape(p.x, p.y, chosen)) {
        drag.current = { id: chosen.id, handle: "move", last: p };
        return;
      }
    }
    // the topmost shape under the pointer; this click selects it, the next drag moves it
    const hit = [...current].reverse().find((s) => pointInShape(p.x, p.y, s));
    select(hit ? hit.id : null);
  });

  useCanvasEvent("pointermove", (event) => {
    const { tool: active, shapes: current, onChange: change } = latest.current;
    const p = { x: event.dataPt.x, y: event.dataPt.y };
    if (active === "polygon" && draftRef.current) setCursor(p);
    const d = drag.current;
    if (!d) return;
    if (d.handle === "draw") {
      setDraft((shape) =>
        shape && shape.kind === "ellipse"
          ? { ...shape, rx: Math.abs(p.x - shape.cx), ry: Math.abs(p.y - shape.cy) }
          : shape,
      );
      return;
    }
    const { id, handle } = d;
    const dx = p.x - d.last.x;
    const dy = p.y - d.last.y;
    d.last = p;
    change(
      current.map((s) => {
        if (s.id !== id) return s;
        return handle === "move" ? translated(s, dx, dy) : withHandleAt(s, handle, p);
      }),
    );
  });

  useCanvasEvent("pointerup", endDrag);
  useCanvasEvent("pointerleave", endDrag);

  useCanvasEvent("click", (event) => {
    const { tool: active } = latest.current;
    const drawing = draftRef.current;
    if (active !== "polygon" || event.sourceEvent.ctrlKey) return;
    const p = { x: event.dataPt.x, y: event.dataPt.y };
    if (!drawing) {
      setDraft({ id: newId(), kind: "polygon", points: [p] });
      setCursor(p);
      return;
    }
    if (drawing.kind !== "polygon") return;
    if (drawing.points.length >= 3 && near(toHtml(drawing.points[0]!), event.htmlPt)) {
      closePolygon();
      return;
    }
    setDraft({ ...drawing, points: [...drawing.points, p] });
  });

  useCanvasEvent("dblclick", () => {
    if (latest.current.tool === "polygon") closePolygon();
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const {
        tool: active,
        shapes: current,
        selectedId: id,
        onChange: change,
        onSelect: select,
      } = latest.current;
      if (event.key === "Escape") {
        setDraft(null);
        setCursor(null);
        drag.current = null;
        select(null);
      } else if (event.key === "Enter" && active === "polygon") {
        closePolygon();
      } else if ((event.key === "Delete" || event.key === "Backspace") && id !== null) {
        change(current.filter((s) => s.id !== id));
        select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // closePolygon reads the latest state through the ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // DataToHtml converts in the canvas tree and SvgElement portals into the SVG overlay: that
  // order, converter outside and portal inside, is the one H5Web's hooks allow
  return (
    <>
      {shapes.map((shape) => (
        <ShapeSvg key={shape.id} shape={shape} selected={shape.id === selectedId} />
      ))}
      {draft ? <DraftSvg shape={draft} cursor={cursor} /> : null}
      {selected ? <Handles shape={selected} /> : null}
    </>
  );
}

function ShapeSvg({ shape, selected }: { shape: Shape; selected: boolean }) {
  const style = {
    fill: FILL,
    stroke: selected ? SELECTED : STROKE,
    strokeWidth: selected ? 2 : 1.5,
  };
  const points = useMemo(() => handlesOf(shape).map(v3), [shape]);
  if (shape.kind === "polygon") {
    if (points.length < 2) return null;
    return (
      <DataToHtml points={points}>
        {(...html) => (
          <SvgElement>
            <polygon
              data-shape={shape.id}
              data-kind="polygon"
              points={html.map((h) => `${h.x},${h.y}`).join(" ")}
              {...style}
            />
          </SvgElement>
        )}
      </DataToHtml>
    );
  }
  return (
    <DataToHtml points={points}>
      {(c, r, t) => (
        <SvgElement>
          <ellipse
            data-shape={shape.id}
            data-kind="ellipse"
            cx={c.x}
            cy={c.y}
            rx={Math.abs(r.x - c.x)}
            ry={Math.abs(t.y - c.y)}
            {...style}
          />
        </SvgElement>
      )}
    </DataToHtml>
  );
}

function DraftSvg({ shape, cursor }: { shape: Shape; cursor: Point | null }) {
  const points = useMemo(
    () =>
      (shape.kind === "polygon" && cursor ? [...shape.points, cursor] : handlesOf(shape)).map(v3),
    [shape, cursor],
  );
  if (shape.kind === "ellipse") {
    return (
      <DataToHtml points={points}>
        {(c, r, t) => (
          <SvgElement>
            <ellipse
              data-draft="ellipse"
              cx={c.x}
              cy={c.y}
              rx={Math.abs(r.x - c.x)}
              ry={Math.abs(t.y - c.y)}
              fill={FILL}
              stroke={STROKE}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          </SvgElement>
        )}
      </DataToHtml>
    );
  }
  return (
    <DataToHtml points={points}>
      {(...html) => (
        <SvgElement>
          <g data-draft="polygon">
            <polyline
              points={html.map((h) => `${h.x},${h.y}`).join(" ")}
              fill="none"
              stroke={STROKE}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
            {html[0] ? (
              <circle cx={html[0].x} cy={html[0].y} r={GRAB} fill="none" stroke={STROKE} />
            ) : null}
            {html.map((h, i) => (
              <circle key={i} cx={h.x} cy={h.y} r={3} fill={STROKE} />
            ))}
          </g>
        </SvgElement>
      )}
    </DataToHtml>
  );
}

function Handles({ shape }: { shape: Shape }) {
  const points = useMemo(() => handlesOf(shape).map(v3), [shape]);
  return (
    <DataToHtml points={points}>
      {(...html) => (
        <SvgElement>
          <g aria-label="handles">
            {html.map((h, i) => (
              <circle
                key={i}
                cx={h.x}
                cy={h.y}
                r={5}
                fill="white"
                stroke={SELECTED}
                strokeWidth={1.5}
              />
            ))}
          </g>
        </SvgElement>
      )}
    </DataToHtml>
  );
}
