// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * A fence around one part of the page: a render error inside it (a browser without WebGL
 * opening the image, a figure that cannot draw) shows as a message in that part, and the rest
 * of the page keeps working. Without one, React unmounts the whole page.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** What the part is, for the message ("the image", "the Cuts tab"). */
  label?: string;
  /** A hint for the known causes, shown under the error. */
  hint?: (error: Error) => ReactNode;
  className?: string;
}

interface State {
  error: Error | null;
}

const WEBGL = /webgl|three|canvas|gl context|WebGLRenderer/i;

/** A hint for a browser whose WebGL is off, the usual reason an image part fails. */
export function webglHint(error: Error): ReactNode {
  if (!WEBGL.test(error.message)) return null;
  return (
    <>
      The image needs WebGL 2, which this browser does not provide. Chrome, Firefox and Safari on a
      desktop have it; over a remote desktop or on a server without a GPU it is often off. Open the
      page in a browser on your own computer (an SSH tunnel to this port works), or turn on hardware
      acceleration in the browser's settings.
    </>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`${this.props.label ?? "a part of the page"} failed to render`, error, info);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    const hint = this.props.hint?.(error) ?? webglHint(error);
    return (
      <div
        role="alert"
        className={`flex h-full min-h-0 flex-col gap-2 overflow-auto p-3 text-xs ${this.props.className ?? ""}`}
      >
        <p className="font-medium text-danger">
          {this.props.label
            ? `${this.props.label} could not be shown.`
            : "This part could not be shown."}
        </p>
        <pre className="whitespace-pre-wrap text-2xs text-muted">{error.message}</pre>
        {hint ? <p className="text-ink-2">{hint}</p> : null}
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="self-start rounded-md border border-line-2 bg-surface px-2 py-0.5 text-xs hover:bg-surface-3"
        >
          Try again
        </button>
      </div>
    );
  }
}
