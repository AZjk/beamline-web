// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, test, vi } from "vitest";

import { JobError, runJob, watchJob, type JobState } from "./jobs";

function state(partial: Partial<JobState>): JobState {
  return {
    id: "j1",
    name: "fit",
    status: "queued",
    done: 0,
    total: 0,
    message: null,
    error: null,
    result: null,
    session: null,
    created: 1,
    started: null,
    finished: null,
    ...partial,
  };
}

/** An EventSource stand-in that replays the given states, each as its own event. */
function fakeSource(states: JobState[], breakAfter?: number) {
  class Fake {
    static instances: Fake[] = [];
    listeners = new Map<string, (event: Event) => void>();
    onerror: (() => void) | null = null;
    closed = false;
    constructor(public url: string) {
      Fake.instances.push(this);
      queueMicrotask(() => this.play());
    }
    addEventListener(name: string, fn: (event: Event) => void) {
      this.listeners.set(name, fn);
    }
    close() {
      this.closed = true;
    }
    play() {
      states.forEach((s, i) => {
        if (breakAfter !== undefined && i === breakAfter) {
          this.onerror?.();
          return;
        }
        if (this.closed) return;
        this.listeners.get(s.status)?.({ data: JSON.stringify(s) } as unknown as Event);
      });
    }
  }
  return Fake as unknown as typeof EventSource & { instances: Fake[] };
}

test("watchJob sees every state and resolves with the final one", async () => {
  const Source = fakeSource([
    state({ status: "running", done: 1, total: 3 }),
    state({ status: "done", done: 3, total: 3, result: 42 }),
  ]);
  const seen: string[] = [];
  const final = await watchJob("j1", (s) => seen.push(`${s.status}:${s.done}`), Source);
  expect(seen).toEqual(["running:1", "done:3"]);
  expect(final.result).toBe(42);
  expect(Source.instances[0]?.url).toMatch(/\/api\/jobs\/j1\/events$/);
  expect(Source.instances[0]?.closed).toBe(true);
});

test("runJob returns the result, or throws a JobError for a failed or cancelled job", async () => {
  const start = vi.fn().mockResolvedValue(state({ status: "queued" }));
  const ok = fakeSource([state({ status: "done", result: { fitted: ["a"] } })]);
  await expect(runJob(start, { EventSourceImpl: ok })).resolves.toEqual({ fitted: ["a"] });

  const failed = fakeSource([state({ status: "failed", error: "RuntimeError: boom" })]);
  await expect(runJob(start, { EventSourceImpl: failed })).rejects.toThrow("RuntimeError: boom");

  const cancelled = fakeSource([state({ status: "cancelled" })]);
  const error = await runJob(start, { EventSourceImpl: cancelled }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(JobError);
  expect((error as JobError).state.status).toBe("cancelled");
});

test("a job that is already finished when it starts needs no stream", async () => {
  const start = async () => state({ status: "done", result: 7 });
  const never = fakeSource([]);
  await expect(runJob(start, { EventSourceImpl: never })).resolves.toBe(7);
  expect(never.instances).toHaveLength(0);
});

test("a broken stream rejects", async () => {
  const broken = fakeSource([state({ status: "running" }), state({ status: "done" })], 1);
  await expect(watchJob("j1", undefined, broken)).rejects.toThrow(/lost the event stream/);
});
