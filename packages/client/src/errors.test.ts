// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { expect, test } from "vitest";

import { ApiError, errorFrom } from "./errors";

test("errorFrom reads the detail of a JSON error body", async () => {
  const response = new Response(JSON.stringify({ detail: "no such file: x.hdf" }), {
    status: 404,
    headers: { "content-type": "application/json" },
  });
  const error = await errorFrom(response);
  expect(error).toBeInstanceOf(ApiError);
  expect(error.status).toBe(404);
  expect(error.message).toBe("no such file: x.hdf");
});

test("errorFrom copes with a body that is not JSON", async () => {
  const error = await errorFrom(new Response("<html>bad gateway</html>", { status: 502 }));
  expect(error.status).toBe(502);
  expect(error.detail).toBeNull();
  expect(error.message).toMatch(/502/);
});
