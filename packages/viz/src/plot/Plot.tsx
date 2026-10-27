// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/// <reference path="../types/plotly.d.ts" />

/**
 * A Plotly figure in the kit's style. Plotly (the gl2d bundle: scatter in SVG, WebGL scatter
 * for large series) loads on first use, so a page that shows no plot never pays for it. The
 * figure follows its box, and when `height` is given the box scrolls instead (a grid of panels).
 */

import type { Config, Layout, PlotData, PlotMouseEvent, PlotRelayoutEvent } from "plotly.js";
import { useEffect, useRef, useState } from "react";

import { CONFIG } from "./theme";

type PlotlyModule = typeof import("plotly.js");

let loader: Promise<PlotlyModule> | null = null;

/** Plotly, loaded once; call early to have it ready when the first figure is drawn. */
export function loadPlotly(): Promise<PlotlyModule> {
  loader ??= import("plotly.js-gl2d-dist-min").then((m) => m.default as unknown as PlotlyModule);
  return loader;
}

export function usePlotly(): PlotlyModule | null {
  const [plotly, setPlotly] = useState<PlotlyModule | null>(null);
  useEffect(() => {
    let live = true;
    loadPlotly().then((m) => {
      if (live) setPlotly(m);
    });
    return () => {
      live = false;
    };
  }, []);
  return plotly;
}

export interface PlotProps {
  data: Partial<PlotData>[];
  layout: Partial<Layout>;
  config?: Partial<Config>;
  /** A fixed figure height; the box scrolls. Without it the figure fills the box. */
  height?: number;
  onHover?: (event: PlotMouseEvent) => void;
  onClick?: (event: PlotMouseEvent) => void;
  onRelayout?: (event: PlotRelayoutEvent) => void;
  className?: string;
  "aria-label"?: string;
}

interface PlotElement extends HTMLDivElement {
  on?: (event: string, handler: (event: never) => void) => void;
  removeAllListeners?: (event: string) => void;
}

export function Plot({
  data,
  layout,
  config,
  height,
  onHover,
  onClick,
  onRelayout,
  className,
  ...aria
}: PlotProps) {
  const box = useRef<HTMLDivElement>(null);
  const plotly = usePlotly();
  const handlers = useRef({ onHover, onClick, onRelayout });
  handlers.current = { onHover, onClick, onRelayout };

  useEffect(() => {
    const el = box.current as PlotElement | null;
    if (!plotly || !el) return;
    const sized: Partial<Layout> = height
      ? { ...layout, height, autosize: false }
      : { ...layout, autosize: true };
    void plotly.react(el, data, sized, { ...CONFIG, ...config });
    el.on?.("plotly_hover", (event: PlotMouseEvent) => handlers.current.onHover?.(event));
    el.on?.("plotly_click", (event: PlotMouseEvent) => handlers.current.onClick?.(event));
    el.on?.("plotly_relayout", (event: PlotRelayoutEvent) => handlers.current.onRelayout?.(event));
    return () => {
      el.removeAllListeners?.("plotly_hover");
      el.removeAllListeners?.("plotly_click");
      el.removeAllListeners?.("plotly_relayout");
    };
  }, [plotly, data, layout, config, height]);

  useEffect(() => {
    const el = box.current;
    if (!plotly || !el || height) return;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth && el.clientHeight) void plotly.Plots.resize(el);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [plotly, height]);

  useEffect(() => {
    const el = box.current;
    return () => {
      if (el) void loadPlotly().then((m) => m.purge(el));
    };
  }, []);

  return (
    <div
      ref={box}
      aria-label={aria["aria-label"]}
      className={className ?? "h-full w-full"}
      style={height ? { height } : undefined}
    />
  );
}
