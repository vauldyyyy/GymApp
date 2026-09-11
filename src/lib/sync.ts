import {
  AppState,
  defaultProfile,
  ActiveWorkout,
  WorkoutRecord,
} from "../types";
import { isAppState } from "../data";

export type LocalCache = {
  version: 2;
  ownerId: string | null;
  state: AppState;
  dirty: boolean;
  updatedAt: number;
  remoteUpdatedAt: string | null;
};
type SyncState = AppState & { syncMeta?: { resetAt: number } };
export function freshState(name = ""): AppState {
  return {
    version: 1,
    profile: { ...defaultProfile, days: [...defaultProfile.days], name },
    history: [],
    saved: [],
    active: null,
  };
}
export function cacheKey(ownerId: string | null): string {
  return `forma-state-v2:${ownerId === null ? "guest" : `account:${encodeURIComponent(ownerId)}`}`;
}
export function makeCache(
  ownerId: string | null,
  state = freshState(),
  dirty = false,
): LocalCache {
  return {
    version: 2,
    ownerId,
    state,
    dirty,
    updatedAt: Date.now(),
    remoteUpdatedAt: null,
  };
}
export function parseCache(
  raw: string | null,
  ownerId: string | null,
): LocalCache | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as LocalCache;
    return value.version === 2 &&
      value.ownerId === ownerId &&
      isAppState(value.state) &&
      typeof value.dirty === "boolean" &&
      Number.isFinite(value.updatedAt) &&
      (value.remoteUpdatedAt === null ||
        (typeof value.remoteUpdatedAt === "string" &&
          Number.isFinite(Date.parse(value.remoteUpdatedAt))))
      ? value
      : null;
  } catch {
    return null;
  }
}
function resetAt(state: AppState): number {
  const value = (state as SyncState).syncMeta?.resetAt;
  return Number.isFinite(value) && Number(value) >= 0 ? Number(value) : 0;
}
export function resetState(): AppState {
  // A reset tombstone prevents another device's older cache resurrecting history.
  return { ...freshState(), syncMeta: { resetAt: Date.now() } } as SyncState;
}
function historyUnion(
  first: WorkoutRecord[],
  second: WorkoutRecord[],
  cutoff: number,
): WorkoutRecord[] {
  const records = new Map<string, WorkoutRecord>();
  for (const record of [...second, ...first]) {
    if (Date.parse(record.completedAt) <= cutoff) continue;
    const old = records.get(record.id);
    if (!old || Date.parse(record.completedAt) >= Date.parse(old.completedAt))
      records.set(record.id, record);
  }
  return [...records.values()].sort(
    (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt),
  );
}
function newestActive(
  first: ActiveWorkout | null,
  second: ActiveWorkout | null,
): ActiveWorkout | null {
  if (!first) return second;
  if (!second || first.id === second.id) return first;
  return Date.parse(first.startedAt) >= Date.parse(second.startedAt)
    ? first
    : second;
}
/** Call only with caches already verified to belong to the same account. */
export function mergeAccountState(
  local: AppState,
  remote: AppState,
  localHasChanges: boolean,
): AppState {
  const primary = localHasChanges ? local : remote;
  const secondary = localHasChanges ? remote : local;
  const cutoff = Math.max(resetAt(local), resetAt(remote));
  const history = historyUnion(primary.history, secondary.history, cutoff);
  // An explicit newer null represents discard/completion. Same-session edits
  // follow the preferred snapshot rather than rechecking previously undone sets.
  let active =
    primary.active === null
      ? null
      : newestActive(primary.active, secondary.active);
  if (
    active &&
    (history.some((record) => record.id === active!.id) ||
      Date.parse(active.startedAt) <= cutoff)
  )
    active = null;
  return {
    ...primary,
    history,
    active,
    ...(cutoff ? { syncMeta: { resetAt: cutoff } } : {}),
  } as SyncState;
}
/** Guest state is imported once; the caller keeps a separate recovery copy. */
export function mergeGuestState(guest: AppState, account: AppState): AppState {
  const cutoff = resetAt(account);
  const history = historyUnion(guest.history, account.history, cutoff);
  let active = newestActive(guest.active, account.active);
  if (
    active &&
    (history.some((record) => record.id === active!.id) ||
      Date.parse(active.startedAt) <= cutoff)
  )
    active = null;
  return {
    ...account,
    profile: account.profile.onboardingDone ? account.profile : guest.profile,
    history,
    saved: [...new Set([...account.saved, ...guest.saved])],
    active,
  };
}
export function hasGuestData(state: AppState): boolean {
  return (
    state.profile.onboardingDone ||
    !!state.profile.name ||
    state.history.length > 0 ||
    state.saved.length > 0 ||
    state.active !== null
  );
}
export function sameState(first: AppState, second: AppState): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

/** Delete only storage whose ownership can be established for this account. */
export function accountStorageKeys(
  accountId: string,
  entries: ReadonlyArray<readonly [string, string | null]>,
): string[] {
  const legacyOwner = entries.find(
    ([key]) => key === "forma-last-account",
  )?.[1];
  const ownedNames = new Set([
    cacheKey(accountId),
    ...["before-restore", "before-reset", "before-merge", "guest-import"].map(
      (reason) => `forma-recovery-v2:${reason}:${accountId}`,
    ),
  ]);
  return entries
    .filter(([key, raw]) => {
      if (
        ownedNames.has(key) ||
        key.startsWith(`forma-recovery-v2:unreadable:${accountId}:`)
      )
        return true;
      if (
        legacyOwner === accountId &&
        [
          "forma-last-account",
          "forma-state-v1",
          "forma-recovery-v2:legacy",
        ].includes(key)
      )
        return true;
      if (!key.startsWith("forma-recovery-v2:") || !raw) return false;
      try {
        return JSON.parse(raw)?.ownerId === accountId;
      } catch {
        return false;
      }
    })
    .map(([key]) => key);
}
