// Copyright © UChicago Argonne LLC
// See LICENSE file for details

// @vitest-environment jsdom
import { beforeEach, expect, test } from "vitest";

import { SESSION_HEADER, newSessionId, resetSessionId, sessionHeaders, sessionId } from "./session";

beforeEach(() => {
  resetSessionId();
  window.sessionStorage.clear();
});

test("the id is made once, kept in sessionStorage and sent as the header", () => {
  const id = sessionId();
  expect(id).toMatch(/^page-[0-9a-f]{32}$/);
  expect(sessionId()).toBe(id);
  expect(window.sessionStorage.getItem("beamline-web:session")).toBe(id);
  expect(sessionHeaders()).toEqual({ [SESSION_HEADER]: id });
  resetSessionId();
  expect(sessionId()).toBe(id);
});

test("ids are distinct", () => {
  expect(newSessionId()).not.toBe(newSessionId());
});
