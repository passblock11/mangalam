"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { CountScope, LivePayload, LiveScope, SectionCounts } from "@/lib/admin-live-types";

const EMPTY_REV: Record<LiveScope, number> = {
  overview: 0,
  verifications: 0,
  users: 0,
  reports: 0,
  payments: 0,
  settings: 0,
  support: 0,
};

const LiveContext = createContext<{
  counts: SectionCounts;
  rev: Record<LiveScope, number>;
}>({ counts: {}, rev: EMPTY_REV });

/** Opens one event stream for this tab. The server pushes; this does not poll. */
export function AdminLiveProvider({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<SectionCounts>({});
  const [rev, setRev] = useState(EMPTY_REV);

  const seen = useRef<{ counts: SectionCounts; settingsStamp: string | null }>({
    counts: {},
    settingsStamp: null,
  });

  useEffect(() => {
    const source = new EventSource("/api/admin/live");
    const onCounts = (event: MessageEvent<string>) => {
      let payload: LivePayload;
      try {
        payload = JSON.parse(event.data) as LivePayload;
      } catch {
        return;
      }
      const previous = seen.current;
      const drifted: LiveScope[] = [];
      const hadSnapshot = Object.keys(previous.counts).length > 0;
      if (hadSnapshot) {
        for (const scope of Object.keys(payload.counts) as CountScope[]) {
          if (previous.counts[scope] !== undefined && previous.counts[scope] !== payload.counts[scope]) {
            drifted.push(scope);
          }
        }
        if (
          previous.settingsStamp &&
          payload.settingsStamp &&
          previous.settingsStamp !== payload.settingsStamp
        ) {
          drifted.push("settings");
        }
      }
      seen.current = {
        counts: { ...previous.counts, ...payload.counts },
        settingsStamp: payload.settingsStamp || previous.settingsStamp,
      };
      setCounts(seen.current.counts);
      const changed = [...new Set<LiveScope>([...payload.changed, ...drifted])];
      if (changed.length === 0) return;
      setRev((current) => {
        const next = { ...current };
        for (const scope of changed) next[scope] += 1;
        return next;
      });
    };
    source.addEventListener("counts", onCounts as EventListener);
    return () => {
      source.removeEventListener("counts", onCounts as EventListener);
      source.close();
    };
  }, []);

  return <LiveContext.Provider value={{ counts, rev }}>{children}</LiveContext.Provider>;
}

export function useSectionCounts() {
  return useContext(LiveContext).counts;
}

/** Changes when a live event touches one of these sections. Starts at 0. */
export function useAdminRevision(scopes: LiveScope | LiveScope[]) {
  const { rev } = useContext(LiveContext);
  const list = Array.isArray(scopes) ? scopes : [scopes];
  return list.reduce((sum, scope) => sum + rev[scope], 0);
}

/**
 * Reload a screen when its data changes. Skips the reload while a field is
 * focused, so a live event cannot wipe text the admin is typing.
 */
export function useAdminLiveReload(scope: LiveScope | LiveScope[], reload: () => void) {
  const rev = useAdminRevision(scope);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    if (rev === 0) return;
    const el = document.activeElement;
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      return;
    }
    reloadRef.current();
  }, [rev]);
}
