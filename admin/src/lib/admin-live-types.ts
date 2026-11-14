/** Shared by the live stream and the admin shell. Settings is live, but it has no sidebar count. */
export const LIVE_SCOPES = [
  "overview",
  "verifications",
  "users",
  "reports",
  "payments",
  "settings",
  "support",
] as const;

export type LiveScope = (typeof LIVE_SCOPES)[number];

export type CountScope = Exclude<LiveScope, "settings">;

export type SectionCounts = Partial<Record<CountScope, number>>;

export type LivePayload = {
  counts: SectionCounts;
  /** Sections whose lists should reload. Empty on the first snapshot. */
  changed: LiveScope[];
  /**
   * Opaque fingerprint of settings rows. The client reloads Settings only when
   * this changes after the first snapshot, so a reconnect does not wipe a form
   * that has not actually changed.
   */
  settingsStamp: string;
};
