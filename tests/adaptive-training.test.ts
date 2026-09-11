import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adaptWorkout,
  buildPlan,
  createSession,
  exercises,
  isAppState,
} from "../src/data";
import {
  buildAdaptivePlan,
  compatibleExercise,
  estimateWorkoutMinutes,
  exerciseMetadata,
  getProgressionInsights,
  getUpcomingPlan,
} from "../src/lib/training";
import {
  defaultProfile,
  type Profile,
  type Workout,
  type WorkoutRecord,
} from "../src/types";

const experienced: Profile = {
  ...defaultProfile,
  experience: "Some experience",
  equipment: "Dumbbells",
  duration: 45,
};
function record(
  ids: string[],
  at: string,
  overrides: Partial<WorkoutRecord> = {},
  profile = experienced,
): WorkoutRecord {
  const session = createSession(
    {
      id: "test-workout",
      name: "Logged training",
      subtitle: "",
      category: "Strength",
      accent: "#fff",
      minutes: 30,
      exercises: ids,
    },
    profile,
    [],
  );
  return {
    ...session,
    id: at,
    startedAt: at,
    completedAt: at,
    durationSeconds: 1200,
    sets: session.sets.map((set) => ({
      ...set,
      reps: 10,
      weight: 20,
      done: true,
    })),
    ...overrides,
  };
}

test("the exercise catalog has complete movement metadata and real equipment compatibility", () => {
  assert.equal(
    new Set(exercises.map((exercise) => exercise.id)).size,
    exercises.length,
  );
  assert.ok(exercises.length >= 35);
  for (const exercise of exercises) {
    assert.ok(
      exerciseMetadata[exercise.id],
      exercise.id + " lacks a movement pattern",
    );
    assert.ok(exercise.instructions.length >= 3);
  }
  const dumbbellPlan = buildPlan({ ...defaultProfile, equipment: "Dumbbells" });
  assert.ok(
    dumbbellPlan.every(
      ({ workout }) => !workout.exercises.includes("bench-press"),
    ),
  );
  const noviceBodyweight = buildPlan({
    ...defaultProfile,
    equipment: "Bodyweight",
  });
  assert.ok(
    noviceBodyweight.every(
      ({ workout }) =>
        !workout.exercises.includes("pike-pushup") &&
        !workout.exercises.includes("full-pushup"),
    ),
  );
  assert.ok(
    noviceBodyweight.every(({ workout }) =>
      workout.reasoning?.some((reason) =>
        reason.includes("does not replace loaded pulling"),
      ),
    ),
  );
});

test("ranked plans are deterministic, cover push/pull/lower movement, and respect every budget", () => {
  for (const goal of ["Build strength", "Build muscle", "Feel fitter"] as const)
    for (const equipment of ["Full gym", "Dumbbells", "Bodyweight"] as const)
      for (const experience of [
        "Getting started",
        "Some experience",
        "Very experienced",
      ] as const)
        for (const duration of [30, 45, 60]) {
          const profile = {
            ...defaultProfile,
            goal,
            equipment,
            experience,
            duration,
          };
          const plan = buildPlan(profile);
          assert.deepEqual(plan, buildPlan(profile));
          for (const { workout } of plan) {
            assert.ok(workout.minutes <= duration, JSON.stringify(profile));
            assert.equal(
              workout.minutes,
              estimateWorkoutMinutes(workout, profile),
            );
            assert.equal(
              workout.prescription?.length,
              workout.exercises.length,
            );
            assert.ok(workout.exercises.length >= 4, JSON.stringify(profile));
            assert.equal(
              new Set(workout.exercises).size,
              workout.exercises.length,
            );
            assert.ok(
              workout.exercises.every((id) =>
                compatibleExercise(
                  exercises.find((exercise) => exercise.id === id)!,
                  profile,
                ),
              ),
            );
            const patterns = workout.exercises.map(
              (id) => exerciseMetadata[id].pattern,
            );
            assert.ok(patterns.includes("squat") || patterns.includes("hinge"));
            assert.ok(patterns.includes("horizontal-push"));
            assert.ok(
              patterns.includes("horizontal-pull") ||
                patterns.includes("upper-back"),
            );
          }
        }
});

test("goals change actual reps and rests while longer budgets add training, not a fake duration", () => {
  const strength = buildPlan(experienced)[0].workout;
  const muscle = buildPlan({ ...experienced, goal: "Build muscle" })[0].workout;
  assert.notDeepEqual(strength.prescription, muscle.prescription);
  assert.ok(
    strength.prescription?.some(
      (target) => target.reps === 8 && target.restSeconds === 120,
    ),
  );
  assert.ok(
    muscle.prescription?.some(
      (target) => target.reps === 10 && target.restSeconds === 90,
    ),
  );
  const long = buildPlan({ ...defaultProfile, duration: 60 })[0].workout;
  assert.ok(long.minutes < 60);
  assert.ok(
    long.exercises.length >
      buildPlan({ ...defaultProfile, duration: 30 })[0].workout.exercises
        .length,
  );
});

test("duration estimation counts prescribed work, both sides, rest and changeovers", () => {
  const routine: Workout = {
    id: "custom-estimate",
    name: "Two movements",
    category: "Custom",
    subtitle: "",
    accent: "#fff",
    minutes: 45,
    exercises: ["row", "floor-press"],
    prescription: [
      { exerciseId: "row", sets: 2, reps: 10, restSeconds: 60 },
      { exerciseId: "floor-press", sets: 3, reps: 8, restSeconds: 90 },
    ],
  };
  // 300 preparation + 120 unilateral work + 60 rest + 72 work + 180 rest + 45 changeover.
  assert.equal(estimateWorkoutMinutes(routine, experienced), 13);
  const adapted = adaptWorkout(routine, { ...experienced, duration: 30 });
  assert.equal(adapted.minutes, 13);
  assert.deepEqual(adapted.prescription, routine.prescription);
});

test("custom routines preserve order, volume, reps and rest across start and persistence", () => {
  const routine: Workout = {
    id: "custom-volume",
    name: "My session",
    subtitle: "",
    category: "Custom",
    minutes: 30,
    accent: "#fff",
    exercises: ["row", "floor-press"],
    prescription: [
      { exerciseId: "row", sets: 5, reps: 12, restSeconds: 180 },
      { exerciseId: "floor-press", sets: 5, reps: 15, restSeconds: 180 },
    ],
  };
  const adapted = adaptWorkout(routine, { ...experienced, duration: 30 });
  assert.ok(adapted.minutes > 30);
  assert.deepEqual(adapted.exercises, routine.exercises);
  const session = createSession(adapted, experienced, [
    record(["row"], "2026-09-11T12:00:00"),
  ]);
  assert.equal(session.sets.length, 10);
  assert.equal(session.sets[0].reps, 12);
  assert.equal(session.sets[0].weight, 20);
  assert.equal(session.prescription?.[0].restSeconds, 180);
  assert.ok(
    isAppState({
      version: 1,
      profile: experienced,
      active: JSON.parse(JSON.stringify(session)),
      saved: [],
      history: [],
    }),
  );
  assert.ok(
    !isAppState({
      version: 1,
      profile: experienced,
      active: {
        ...session,
        prescription: [
          { exerciseId: "row", sets: 500, reps: 12, restSeconds: 180 },
        ],
      },
      saved: [],
      history: [],
    }),
  );
});

test("adaptive planning uses only completed evidence and can reprioritize today's split", () => {
  const now = new Date("2026-09-14T12:00:00");
  const profile = { ...experienced, days: [1, 2, 4, 5] };
  const recent = record(["floor-press", "row", "press"], "2026-09-13T20:00:00");
  const result = buildAdaptivePlan(profile, [recent], { now });
  assert.equal(result.basis.completedSessions, 1);
  assert.equal(result.basis.completedSets, 9);
  assert.ok(
    result.adjustments.some(
      (adjustment) => adjustment.id === "recent-training",
    ),
  );
  const today = result.plan.find((entry) => entry.day === 1)!.workout;
  assert.ok(today.name.startsWith("Lower body"));
  assert.notDeepEqual(result.plan, buildPlan(profile));
  const empty = buildAdaptivePlan(profile, [], { now });
  assert.deepEqual(empty.plan, buildPlan(profile));
  assert.equal(empty.basis.completedSets, 0);
  assert.deepEqual(empty.progression, []);
});

test("an unfinished session can reduce next volume without inferring fatigue", () => {
  const latest = record(["floor-press", "row", "rdl"], "2026-09-13T12:00:00");
  latest.sets.forEach((set, index) => {
    set.done = index < 2;
  });
  const result = buildAdaptivePlan(experienced, [latest], {
    now: new Date("2026-09-14T12:00:00"),
  });
  assert.ok(
    result.adjustments.some(
      (adjustment) => adjustment.id === "finishable-volume",
    ),
  );
  const today = result.plan.find((entry) => entry.day === 1)!.workout;
  assert.ok(today.prescription?.every((target) => target.sets === 2));
  assert.equal(result.basis.completedSets, 2);
  const stale = buildAdaptivePlan(experienced, [latest], {
    now: new Date("2026-10-14T12:00:00"),
  });
  assert.ok(
    !stale.adjustments.some(
      (adjustment) => adjustment.id === "finishable-volume",
    ),
  );
});

test("current workload is not used as a claimed recovery measure for a later scheduled day", () => {
  const recent = record(["floor-press", "row"], "2026-09-12T09:00:00");
  const result = buildAdaptivePlan(experienced, [recent], {
    now: new Date("2026-09-12T12:00:00"),
  });
  assert.ok(
    !result.adjustments.some(
      (adjustment) => adjustment.id === "recent-training",
    ),
  );
  const unfinished = {
    ...recent,
    sets: recent.sets.map((set) => ({ ...set, done: false })),
  };
  assert.equal(
    buildAdaptivePlan(experienced, [unfinished]).basis.completedSessions,
    0,
  );
});

test("finishing today's training advances the next session across weekdays and week boundaries", () => {
  const monday = new Date("2026-09-14T12:00:00");
  const profile = { ...experienced, days: [1, 2, 4, 5] };
  const plan = buildPlan(profile);
  const finished = record(["floor-press", "row"], "2026-09-14T09:00:00");
  assert.equal(getUpcomingPlan(plan, [], monday)[0].day, 1);
  const upcoming = getUpcomingPlan(plan, [finished], monday);
  assert.deepEqual(
    upcoming.map((entry) => entry.day),
    [2, 4, 5, 1],
  );
  const adaptive = buildAdaptivePlan(profile, [finished], { now: monday });
  assert.ok(
    !adaptive.adjustments.some((item) => item.id === "recent-training"),
  );
  const unfinished = {
    ...finished,
    sets: finished.sets.map((set) => ({ ...set, done: false })),
  };
  assert.equal(getUpcomingPlan(plan, [unfinished], monday)[0].day, 1);
  const sunday = new Date("2026-09-20T12:00:00");
  const sundayPlan = buildPlan({ ...experienced, days: [0, 2, 4] });
  const sundayDone = record(["row"], "2026-09-20T09:00:00");
  assert.deepEqual(
    getUpcomingPlan(sundayPlan, [sundayDone], sunday).map((entry) => entry.day),
    [2, 4, 0],
  );
});

test("progression requires two fully completed sessions at one load and never applies suggested increases", () => {
  const first = record(["floor-press"], "2026-09-10T12:00:00");
  const second = record(["floor-press"], "2026-09-12T12:00:00");
  const insight = getProgressionInsights(experienced, [first, second])[0];
  assert.equal(insight.status, "consider-increase");
  assert.equal(insight.lastLoad, 20);
  assert.equal(insight.suggestedLoad, 20.5);
  assert.equal(insight.completedSessions, 2);
  assert.equal(insight.completedSets, 6);
  const session = createSession(
    buildPlan(experienced)[0].workout,
    experienced,
    [second, first],
  );
  for (const set of session.sets.filter(
    (set) => set.exerciseId === "floor-press",
  ))
    assert.equal(set.weight, 20);
  assert.equal(
    getProgressionInsights(experienced, [second, second])[0].status,
    "build-baseline",
  );
  const partial = {
    ...second,
    sets: second.sets.map((set, index) => ({ ...set, done: index < 2 })),
  };
  assert.equal(
    getProgressionInsights(experienced, [first, partial])[0].status,
    "repeat",
  );
  const lowRep = {
    ...second,
    sets: second.sets.map((set) => ({ ...set, reps: 8 })),
  };
  assert.equal(
    getProgressionInsights(experienced, [first, lowRep])[0].status,
    "repeat",
  );
});

test("progression normalizes units and ignores unfinished, zero-load and bodyweight increases", () => {
  const kg = record(["floor-press"], "2026-09-10T12:00:00");
  const lb = record(["floor-press"], "2026-09-12T12:00:00", { unit: "lb" });
  lb.sets = lb.sets.map((set) => ({ ...set, weight: 44.0924524 }));
  assert.equal(
    getProgressionInsights(experienced, [kg, lb])[0].suggestedLoad,
    20.5,
  );
  const zero = { ...lb, sets: lb.sets.map((set) => ({ ...set, weight: 0 })) };
  assert.equal(
    getProgressionInsights(experienced, [kg, zero])[0].suggestedLoad,
    undefined,
  );
  const body = record(["squat"], "2026-09-10T12:00:00");
  const body2 = record(["squat"], "2026-09-12T12:00:00");
  assert.equal(
    getProgressionInsights(experienced, [body, body2])[0].suggestedLoad,
    undefined,
  );
});

test("progression uses the recorded custom target and resets the comparison after a prescription change", () => {
  const first = record(["floor-press"], "2026-09-10T12:00:00");
  const second = record(["floor-press"], "2026-09-12T12:00:00");
  for (const entry of [first, second]) {
    entry.prescription = [
      { exerciseId: "floor-press", sets: 3, reps: 15, restSeconds: 90 },
    ];
    entry.sets = entry.sets.map((set) => ({ ...set, reps: 15 }));
  }
  const insight = getProgressionInsights(experienced, [first, second])[0];
  assert.equal(insight.targetReps, 15);
  assert.equal(insight.status, "repeat");
  for (const entry of [first, second])
    entry.sets = entry.sets.map((set) => ({ ...set, reps: 17 }));
  assert.equal(
    getProgressionInsights(experienced, [first, second])[0].status,
    "consider-increase",
  );
  first.prescription![0].reps = 12;
  assert.equal(
    getProgressionInsights(experienced, [first, second])[0].status,
    "repeat",
  );
});
