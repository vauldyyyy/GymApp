import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adaptWorkout,
  buildPlan,
  createSession,
  estimateWorkoutMinutes,
  exerciseById,
  isAppState,
  volumeKg,
  weekHistory,
  workouts,
} from "../src/data";
import { defaultProfile, AppState, WorkoutRecord } from "../src/types";
test("personal plans honor chosen days, available equipment, time, and unique exercise IDs", () => {
  for (const equipment of ["Full gym", "Dumbbells", "Bodyweight"] as const) {
    for (const duration of [30, 45, 60]) {
      const profile = {
        ...defaultProfile,
        equipment,
        duration,
        days: [0, 2, 4, 6],
      };
      const plan = buildPlan(profile);
      assert.deepEqual(
        plan.map((p) => p.day),
        [2, 4, 6, 0],
      );
      for (const { workout } of plan) {
        assert.ok(workout.minutes <= duration);
        assert.equal(new Set(workout.exercises).size, workout.exercises.length);
        for (const id of workout.exercises) {
          const e = exerciseById(id);
          assert.ok(e);
          if (equipment === "Bodyweight")
            assert.equal(e.equipment, "Bodyweight");
          if (equipment === "Dumbbells")
            assert.notEqual(e.equipment, "Full gym");
        }
      }
    }
  }
});
test("new sessions use actual completed previous sets and convert lb to kg", () => {
  const w = adaptWorkout(workouts[0], defaultProfile);
  const old = createSession(w, { ...defaultProfile, unit: "lb" }, []);
  old.sets[0] = { ...old.sets[0], weight: 22.0462262, reps: 9, done: true };
  old.sets[1] = { ...old.sets[1], weight: 200, reps: 1, done: false };
  const record: WorkoutRecord = {
    ...old,
    completedAt: new Date().toISOString(),
    durationSeconds: 900,
  };
  const next = createSession(w, defaultProfile, [record]);
  assert.equal(next.sets[0].weight, 10);
  assert.equal(next.sets[0].reps, 9);
  assert.equal(next.sets[1].weight, 0);
  assert.ok(next.sets.every((s) => !s.done));
  assert.ok(Math.abs(volumeKg(record) - 90) < 0.01);
});
test("experience changes set count and longer training adds volume", () => {
  const short = adaptWorkout(workouts[0], { ...defaultProfile, duration: 30 });
  const long = adaptWorkout(workouts[0], { ...defaultProfile, duration: 60 });
  assert.ok(short.minutes <= 30);
  assert.equal(short.minutes, estimateWorkoutMinutes(short, defaultProfile));
  assert.ok(long.exercises.length > short.exercises.length);
  const beginner = createSession(short, defaultProfile, []);
  const experiencedProfile = {
    ...defaultProfile,
    experience: "Very experienced" as const,
  };
  const experienced = createSession(
    adaptWorkout(workouts[0], experiencedProfile),
    experiencedProfile,
    [],
  );
  assert.ok(experienced.sets.length > beginner.sets.length);
  assert.ok(long.minutes > short.minutes);
});
test("week boundaries include Monday midnight and exclude next Monday", () => {
  const active = createSession(workouts[0], defaultProfile, []);
  const dates = [
    "2026-09-06T23:59:59",
    "2026-09-07T00:00:00",
    "2026-09-13T23:59:59",
    "2026-09-14T00:00:00",
  ];
  const history = dates.map((date, i) => ({
    ...active,
    id: String(i),
    completedAt: new Date(date).toISOString(),
    durationSeconds: 1,
  }));
  assert.deepEqual(
    weekHistory(history, new Date("2026-09-12T12:00:00")).map((h) => h.id),
    ["1", "2"],
  );
});
test("persisted state rejects malformed profiles and invalid session inputs", () => {
  const state: AppState = {
    version: 1,
    profile: defaultProfile,
    history: [],
    active: null,
    saved: [],
  };
  assert.equal(isAppState(state), true);
  assert.equal(
    isAppState({ ...state, profile: { ...defaultProfile, days: [1, 1] } }),
    false,
  );
  assert.equal(
    isAppState({
      ...state,
      profile: { ...defaultProfile, equipment: "unknown" },
    }),
    false,
  );
  const active = createSession(workouts[0], defaultProfile, []);
  assert.equal(isAppState({ ...state, active }), true);
  active.sets[0].weight = -3;
  assert.equal(isAppState({ ...state, active }), false);
  active.sets[0].weight = 0;
  active.sets[0].reps = NaN;
  assert.equal(isAppState({ ...state, active }), false);
});
