// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * Jobs, as `beamline_webkit.jobs` serves them: a route starts one and answers with its state,
 * `/api/jobs/{id}/events` streams every change as Server-Sent Events, `DELETE /api/jobs/{id}`
 * cancels it. `runJob` ties the three together for a page.
 */

import { apiUrl } from "./api";
import { ApiError } from "./errors";
import { sessionHeaders } from "./session";

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface JobState<R = unknown> {
  id: string;
  name: string;
  status: JobStatus;
  done: number;
  total: number;
  message: string | null;
  error: string | null;
  result: R | null;
  session: string | null;
  created: number;
  started: number | null;
  finished: number | null;
}

export const FINISHED: ReadonlySet<JobStatus> = new Set(["done", "failed", "cancelled"]);

/** A job that ended without a result: failed, or cancelled. */
export class JobError extends Error {
  readonly state: JobState;

  constructor(state: JobState) {
    super(
      state.status === "cancelled"
        ? `${state.name || "job"} cancelled`
        : (state.error ?? `${state.name || "job"} failed`),
    );
    this.name = "JobError";
    this.state = state;
  }
}

/** The events URL of a job, under the page's folder. */
export function jobEventsUrl(id: string): string {
  return apiUrl(`/api/jobs/${encodeURIComponent(id)}/events`);
}

/**
 * Follow a job's event stream until it finishes. `onState` sees every state; the promise
 * resolves with the final one (whatever its status) and rejects when the stream breaks.
 */
export function watchJob<R = unknown>(
  id: string,
  onState?: (state: JobState<R>) => void,
  EventSourceImpl: typeof EventSource = EventSource,
): Promise<JobState<R>> {
  return new Promise((resolve, reject) => {
    const source = new EventSourceImpl(jobEventsUrl(id));
    let last: JobState<R> | null = null;
    const handle = (event: Event) => {
      const state = JSON.parse((event as MessageEvent<string>).data) as JobState<R>;
      last = state;
      onState?.(state);
      if (FINISHED.has(state.status)) {
        source.close();
        resolve(state);
      }
    };
    for (const name of ["queued", "running", "done", "failed", "cancelled"]) {
      source.addEventListener(name, handle);
    }
    source.onerror = () => {
      source.close();
      if (last && FINISHED.has(last.status)) resolve(last);
      else reject(new Error(`lost the event stream of job ${id}`));
    };
  });
}

export interface RunJobOptions<R> {
  onProgress?: (state: JobState<R>) => void;
  EventSourceImpl?: typeof EventSource;
}

/**
 * Start a job and wait for it: `start` posts the request and returns the job's first state;
 * the result of the finished job is returned, a failed or cancelled job throws a `JobError`.
 */
export async function runJob<R = unknown>(
  start: () => Promise<JobState<R>>,
  options: RunJobOptions<R> = {},
): Promise<R> {
  const first = await start();
  options.onProgress?.(first);
  const final = FINISHED.has(first.status)
    ? first
    : await watchJob<R>(first.id, options.onProgress, options.EventSourceImpl);
  if (final.status !== "done") throw new JobError(final);
  return final.result as R;
}

/** Ask the service to stop a job; the stream then ends with the cancelled state. */
export async function cancelJob(id: string): Promise<JobState> {
  const response = await fetch(apiUrl(`/api/jobs/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: sessionHeaders(),
  });
  if (!response.ok) throw new ApiError(response.status, await response.text());
  return (await response.json()) as JobState;
}
