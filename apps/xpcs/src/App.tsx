// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { ApiError, createQueryClient } from "@beamline-web/client";
import { AppShell, Placeholder, Tabs, useShortcuts, useStale } from "@beamline-web/ui";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { useInfo } from "./api/queries";
import { FilesPane } from "./files/FilesPane";
import { registry } from "./plugins";
import { labelOf, useAppStore } from "./store";
import { useUrlState } from "./urlState";

const queryClient = createQueryClient();

function Brand() {
  return (
    <>
      <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
        <defs>
          <linearGradient id="brand-c2" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#0b2559" />
            <stop offset="1" stopColor="#2a78d6" />
          </linearGradient>
        </defs>
        <rect width="18" height="18" rx="4" fill="url(#brand-c2)" />
        <path d="M3 15L15 3" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M6 15L15 6M3 12L12 3"
          stroke="#fff"
          strokeWidth="0.9"
          strokeOpacity="0.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-[13px] font-semibold tracking-tight">
        py<span className="text-accent">XPCS</span>Viewer
        <span className="font-normal text-muted">-web</span>
      </span>
    </>
  );
}

/** A tab's content with its stale dot: hidden tabs do not fetch, they wait to be shown. */
function TabContent({ id, visible }: { id: string; visible: boolean }) {
  const plugin = registry.get(id)!;
  const Component = plugin.component;
  return (
    <div className="h-full min-h-0">
      <Component visible={visible} />
    </div>
  );
}

function AnalysisTabs() {
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const active = useAppStore((s) => s.active);
  const selection = useAppStore((s) => s.selection);
  const plugins = registry.list("tab");
  const ids = plugins.map((p) => p.id);
  const current = ids.includes(tab) ? tab : (ids[0] ?? "");
  const staleG2 = useStale(current === "g2", [active, selection]);
  const staleTauq = useStale(current === "tauq", [active, selection]);
  const staleTwotime = useStale(current === "twotime", [active]);
  const staleHdf = useStale(current === "hdf", [active]);
  const stale: Record<string, boolean> = {
    g2: staleG2,
    tauq: staleTauq,
    twotime: staleTwotime,
    hdf: staleHdf,
  };
  const items = useMemo(
    () => plugins.map((p) => ({ id: p.id, label: p.label, title: p.title, stale: stale[p.id] })),
    [plugins, staleG2, staleTauq, staleTwotime, staleHdf],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  useShortcuts(
    useMemo(
      () => Object.fromEntries(ids.map((id, i) => [String(i + 1), () => setTab(id)])),
      [ids, setTab],
    ),
  );
  return (
    <Tabs tabs={items} value={current} onChange={setTab} aria-label="Analyses" className="h-full">
      {(id) => <TabContent id={id} visible={id === current} />}
    </Tabs>
  );
}

function Page() {
  const info = useInfo();
  const [listed, setListed] = useState(false);
  useUrlState(listed);
  const active = useAppStore((s) => s.active);
  const files = useAppStore((s) => s.files);
  const status = active ? labelOf({ files }, active) : "No file shown";
  useEffect(() => {
    document.title = active ? `${labelOf({ files }, active)} — pyXPCSViewer` : "pyXPCSViewer";
  }, [active, files]);

  if (info.error) {
    const reason =
      info.error instanceof ApiError
        ? `${info.error.status}: ${info.error.message}`
        : info.error.message;
    return (
      <AppShell
        brand={<Brand />}
        status={<span className="text-danger">no service</span>}
        left={null}
        center={
          <Placeholder error>Could not reach the service at api/info ({reason}).</Placeholder>
        }
        right={null}
      />
    );
  }
  return (
    <AppShell
      brand={<Brand />}
      subtitle={info.data?.root}
      status={status}
      version={info.data?.version}
      storageKey="xpcs:shell"
      left={<FilesPane onListed={() => setListed(true)} />}
      center={
        <Placeholder>
          The detector image and its panels arrive with the next step of Phase 1.
        </Placeholder>
      }
      right={<AnalysisTabs />}
    />
  );
}

/** The app; a test passes its own query client so nothing is cached across tests. */
export function App({ client = queryClient }: { client?: QueryClient }) {
  return (
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>
  );
}
