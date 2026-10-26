// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { ApiError, fetchJson } from "@beamline-web/client";
import { AppShell } from "@beamline-web/ui";
import { Readout } from "@beamline-web/viz";
import { useEffect, useState } from "react";

import type { paths } from "./api/schema";

/** The answer of the tool's info route, typed from its OpenAPI document. */
type Info = paths["/api/info"]["get"]["responses"]["200"]["content"]["application/json"];

type Connection =
  { state: "probing" } | { state: "connected"; info: Info } | { state: "absent"; reason: string };

export function App() {
  const [connection, setConnection] = useState<Connection>({ state: "probing" });

  useEffect(() => {
    let cancelled = false;
    // relative, so the probe follows whatever prefix the page is served under
    fetchJson<Info>("api/info")
      .then((info) => {
        if (!cancelled) setConnection({ state: "connected", info });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const reason =
          error instanceof ApiError ? `${error.status}: ${error.message}` : String(error);
        setConnection({ state: "absent", reason });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell
      title="pyXPCSViewer web"
      version={connection.state === "connected" ? String(connection.info.version ?? "") : undefined}
    >
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Empty app. The file browser, detector image and analysis tabs arrive in Phase 1.
      </p>
      <p className="mt-2 text-sm" data-testid="connection">
        {connection.state === "probing" && "Looking for the service…"}
        {connection.state === "connected" && `Connected to ${String(connection.info.root ?? "")}`}
        {connection.state === "absent" && `No service at api/info (${connection.reason})`}
      </p>
      <div className="mt-4">
        <Readout />
      </div>
    </AppShell>
  );
}
