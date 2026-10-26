// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/**
 * The page's session: the id it sends as `X-Session-Id`, which the service keys per-page state
 * on (fit results, a mask, a loaded setup). It lives in sessionStorage, so every browser tab is
 * its own session and a reload keeps it; a private window without storage gets a fresh one per load.
 */

export const SESSION_HEADER = "X-Session-Id";
const STORAGE_KEY = "beamline-web:session";

let cached: string | null = null;

/** A fresh session id: 8 to 64 of the characters the service accepts. */
export function newSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return "page-" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The page's session id, made on first use and kept for the tab. */
export function sessionId(): string {
  if (cached) return cached;
  let id: string | null = null;
  try {
    id = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    /* no storage: a fresh id below */
  }
  if (!id) {
    id = newSessionId();
    try {
      window.sessionStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* no storage: the id lives for this load */
    }
  }
  cached = id;
  return id;
}

/** The header that names the session, for a plain `fetch`. */
export function sessionHeaders(): Record<string, string> {
  return { [SESSION_HEADER]: sessionId() };
}

/** For tests: forget the cached id. */
export function resetSessionId(): void {
  cached = null;
}
