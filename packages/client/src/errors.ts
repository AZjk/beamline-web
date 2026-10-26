// Copyright © UChicago Argonne LLC
// See LICENSE file for details

/** The one error shape every service answers with: `{"detail": "..."}` and a status code. */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown, message?: string) {
    super(
      message ?? (typeof detail === "string" ? detail : `request failed with status ${status}`),
    );
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

/** The `detail` of a JSON error body, the body itself when it has no `detail`, null when it is not JSON. */
async function detailOf(response: Response): Promise<unknown> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === "object" && "detail" in body ? body.detail : body;
  } catch {
    return null;
  }
}

/** The `ApiError` for a failed response. */
export async function errorFrom(response: Response): Promise<ApiError> {
  return new ApiError(response.status, await detailOf(response));
}

/** Fetch a JSON endpoint. Rejects with an `ApiError` on a non-2xx answer. */
export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) throw await errorFrom(response);
  return (await response.json()) as T;
}
