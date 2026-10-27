// Copyright © UChicago Argonne LLC
// See LICENSE file for details

import { ApiError, createQueryClient } from "@beamline-web/client";
import {
  AppShell,
  ErrorBoundary,
  Placeholder,
  Tabs,
  useShortcuts,
  useStale,
} from "@beamline-web/ui";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { useInfo, useSessionSetup } from "./api/queries";
import { FilesPane } from "./files/FilesPane";
import { ImagePane } from "./image/ImagePane";
import { registry } from "./plugins";
import { labelOf, useAppStore } from "./store";
import { useUrlState } from "./urlState";

const queryClient = createQueryClient();

function Brand() {
  return (
    <>
      <svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true">
        <rect width="18" height="18" rx="4" fill="#2a78d6" />
        <path
          d="M4 13 Q9 2 14 13"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="9" cy="13" r="1.4" fill="#fff" />
      </svg>
      <span className="text-[13px] font-semibold tracking-tight">
        gixsu<span className="font-normal text-muted">-web</span>
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
      <ErrorBoundary label={`The ${typeof plugin.label === "string" ? plugin.label : id} tab`}>
        <Component visible={visible} />
      </ErrorBoundary>
    </div>
  );
}

function AnalysisTabs() {
  const tab = useAppStore((s) => s.tab);
  const setTab = useAppStore((s) => s.setTab);
  const active = useAppStore((s) => s.active);
  const selection = useAppStore((s) => s.selection);
  const processing = useAppStore((s) => s.processing);
  const boxes = useAppStore((s) => s.boxes);
  const plugins = registry.list("tab");
  const ids = plugins.map((p) => p.id);
  const current = ids.includes(tab) ? tab : (ids[0] ?? "");
  const inputs = [active, selection, processing, boxes];
  const stale: Record<string, boolean> = {};
  for (const id of ids) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    stale[id] = useStale(current === id, inputs);
  }
  const items = useMemo(
    () => plugins.map((p) => ({ id: p.id, label: p.label, title: p.title, stale: stale[p.id] })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plugins, ...ids.map((id) => stale[id])],
  );
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

/** The session's setup file (loaded by --workflow, or by this page earlier) sets the controls once. */
function useSetupStart() {
  const session = useSessionSetup();
  const setSetup = useAppStore((s) => s.setSetup);
  const setProcessing = useAppStore((s) => s.setProcessing);
  useEffect(() => {
    if (!session.data) return;
    setSetup(session.data);
    const info = session.data.setup;
    if (info)
      setProcessing({
        level: info.level,
        frame: info.frame,
        normalization: info.normalization,
        sample: info.sample,
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.data]);
}

function Page() {
  const info = useInfo();
  const [listed, setListed] = useState(false);
  useUrlState(listed);
  useSetupStart();
  const active = useAppStore((s) => s.active);
  const files = useAppStore((s) => s.files);
  const message = useAppStore((s) => s.message);
  const status = message ?? (active ? labelOf({ files }, active) : "No file shown");
  useEffect(() => {
    document.title = active ? `${labelOf({ files }, active)} — gixsu` : "gixsu web";
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
      storageKey="gixs:shell"
      defaultLayout={[22, 46, 32]}
      left={<FilesPane onListed={() => setListed(true)} />}
      center={
        <div className="h-full p-1.5">
          <ErrorBoundary label="The image" className="rounded-md border border-line bg-surface">
            <ImagePane />
          </ErrorBoundary>
        </div>
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
