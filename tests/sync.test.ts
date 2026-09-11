import assert from "node:assert/strict";
import { test } from "node:test";
import { AppState, ActiveWorkout, WorkoutRecord } from "../src/types";
import {
  accountStorageKeys,
  cacheKey,
  freshState,
  makeCache,
  mergeAccountState,
  mergeGuestState,
  parseCache,
  resetState,
} from "../src/lib/sync";

function active(id: string, at = "2026-09-12T08:00:00Z"): ActiveWorkout {
  return {
    id,
    workoutId: "full",
    name: "Full body foundations",
    startedAt: at,
    exercises: ["goblet-squat"],
    unit: "kg",
    sets: [
      { exerciseId: "goblet-squat", index: 0, reps: 8, weight: 20, done: true },
    ],
  };
}
function record(id: string, at = "2026-09-12T09:00:00Z"): WorkoutRecord {
  return { ...active(id), completedAt: at, durationSeconds: 1200 };
}
function state(values: Partial<AppState> = {}): AppState {
  return { ...freshState(), ...values };
}

test("account caches require matching ownership and guest keys cannot collide", () => {
  const cache = makeCache("account-a", state({ history: [record("a")] }), true);
  assert.ok(parseCache(JSON.stringify(cache), "account-a"));
  assert.equal(parseCache(JSON.stringify(cache), "account-b"), null);
  assert.equal(parseCache(JSON.stringify(cache), null), null);
  assert.notEqual(cacheKey(null), cacheKey("guest"));
  assert.notEqual(cacheKey("a:b"), cacheKey("a%3Ab"));
  assert.equal(parseCache("{bad", null), null);
  const first = freshState();
  first.profile.days.push(6);
  assert.deepEqual(freshState().profile.days, [1, 3, 5]);
});

test("same-account merge retains unique workout IDs and resolves duplicates by completion time", () => {
  const local = state({
    history: [record("local"), record("shared", "2026-09-12T11:00:00Z")],
  });
  const remote = state({
    history: [record("remote"), record("shared", "2026-09-12T10:00:00Z")],
  });
  const merged = mergeAccountState(local, remote, true);
  assert.deepEqual(
    new Set(merged.history.map((item) => item.id)),
    new Set(["local", "remote", "shared"]),
  );
  assert.equal(
    merged.history.find((item) => item.id === "shared")?.completedAt,
    "2026-09-12T11:00:00Z",
  );
  assert.equal(merged.history[0].id, "shared");
  assert.equal(local.history.length, 2);
  assert.equal(remote.history.length, 2);
});

test("completed or deliberately discarded workouts are never resurrected as active", () => {
  const remote = state({ active: active("same-session") });
  const complete = state({ active: null, history: [record("same-session")] });
  assert.equal(mergeAccountState(complete, remote, true).active, null);
  const discarded = state({ active: null });
  assert.equal(mergeAccountState(discarded, remote, true).active, null);
  assert.equal(mergeAccountState(remote, complete, false).active, null);
});

test("active session merging keeps the latest session and respects locally edited set values", () => {
  const local = state({
    active: {
      ...active("same-session"),
      sets: [
        {
          exerciseId: "goblet-squat",
          index: 0,
          reps: 10,
          weight: 25,
          done: false,
        },
      ],
    },
  });
  const remote = state({ active: active("same-session") });
  assert.deepEqual(
    mergeAccountState(local, remote, true).active?.sets,
    local.active?.sets,
  );
  assert.deepEqual(
    mergeAccountState(local, remote, false).active?.sets,
    remote.active?.sets,
  );
  const later = state({
    active: active("new-session", "2026-09-12T13:00:00Z"),
  });
  assert.equal(mergeAccountState(local, later, true).active?.id, "new-session");
});

test("guest import retains both histories and preserves an established account profile", () => {
  const guest = state({
    profile: { ...freshState().profile, name: "Guest", onboardingDone: true },
    history: [record("guest-workout")],
    saved: ["full"],
    active: active("guest-session", "2026-09-12T13:00:00Z"),
  });
  const account = state({
    profile: { ...freshState().profile, name: "Alex", onboardingDone: true },
    history: [record("account-workout")],
    saved: ["full", "upper"],
    active: active("account-session"),
  });
  const imported = mergeGuestState(guest, account);
  assert.equal(imported.profile.name, "Alex");
  assert.deepEqual(
    new Set(imported.history.map((item) => item.id)),
    new Set(["guest-workout", "account-workout"]),
  );
  assert.deepEqual(imported.saved, ["full", "upper"]);
  assert.equal(imported.active?.id, "guest-session");
  assert.equal(mergeGuestState(guest, freshState()).profile.name, "Guest");
  assert.equal(guest.history.length, 1);
});

test("reset tombstones remove old history during future merges without deleting newer workouts", () => {
  const cleared = resetState();
  const past = new Date(Date.now() - 60_000).toISOString();
  const future = new Date(Date.now() + 60_000).toISOString();
  const stale = state({
    history: [record("old", past), record("new", future)],
    active: active("old-session", past),
  });
  const merged = mergeAccountState(stale, cleared, true);
  assert.deepEqual(
    merged.history.map((item) => item.id),
    ["new"],
  );
  assert.equal(merged.active, null);
  const repeated = mergeAccountState(stale, merged, false);
  assert.deepEqual(
    repeated.history.map((item) => item.id),
    ["new"],
  );
});

test("account deletion selects owned caches and backups while preserving guest and other accounts", () => {
  const owned = JSON.stringify(
    makeCache("a", state({ history: [record("a-workout")] })),
  );
  const other = JSON.stringify(makeCache("b"));
  const guest = JSON.stringify(makeCache(null));
  const entries: [string, string][] = [
    [cacheKey("a"), owned],
    [cacheKey("b"), other],
    [cacheKey(null), guest],
    ["forma-recovery-v2:before-reset:a", owned],
    ["forma-recovery-v2:guest-import:a", owned],
    ["forma-recovery-v2:before-reset:b", other],
    ["forma-recovery-v2:unknown-record", owned],
    ["forma-recovery-v2:unreadable:a:123", "{broken"],
    ["forma-recovery-v2:unreadable:b:456", "{broken"],
    ["forma-last-account", "a"],
    ["forma-state-v1", "{}"],
    ["forma-recovery-v2:legacy", "{}"],
    ["forma-state-v2:migrated", "1"],
    ["unrelated-app-key", "private"],
  ];
  const removed = accountStorageKeys("a", entries);
  assert.deepEqual(
    new Set(removed),
    new Set([
      cacheKey("a"),
      "forma-recovery-v2:before-reset:a",
      "forma-recovery-v2:guest-import:a",
      "forma-recovery-v2:unknown-record",
      "forma-recovery-v2:unreadable:a:123",
      "forma-last-account",
      "forma-state-v1",
      "forma-recovery-v2:legacy",
    ]),
  );
  assert.equal(
    accountStorageKeys("b", entries).includes("forma-state-v1"),
    false,
  );
});
