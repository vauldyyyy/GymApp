import {
  AppState,
  Exercise,
  Profile,
  Workout,
  WorkoutRecord,
  ActiveWorkout,
} from "./types";

import { exercises, exerciseById } from "./lib/exercise-catalog";
export { exercises, exerciseById } from "./lib/exercise-catalog";
import {
  composePlan,
  estimateWorkoutMinutes,
  prescriptionForExercise,
  compatibleExercise,
  exerciseMetadata,
} from "./lib/training";
export {
  buildAdaptivePlan,
  getProgressionInsights,
  estimateWorkoutMinutes,
  getUpcomingPlan,
} from "./lib/training";
export const workouts: Workout[] = [
  {
    id: "full",
    name: "Full body foundations",
    subtitle: "A little of everything. A stronger you.",
    category: "Strength",
    minutes: 45,
    exercises: ["goblet-squat", "bench-press", "row", "rdl", "deadbug"],
    accent: "#D8DEC8",
  },
  {
    id: "upper",
    name: "Upper body strength",
    subtitle: "Build strength from the shoulders down.",
    category: "Strength",
    minutes: 45,
    exercises: ["bench-press", "pulldown", "press", "cable-row", "curl"],
    accent: "#E7DACE",
  },
  {
    id: "lower",
    name: "Lower body, higher potential",
    subtitle: "Find your power from the ground up.",
    category: "Strength",
    minutes: 45,
    exercises: ["goblet-squat", "rdl", "legpress", "lunge", "calf"],
    accent: "#DEDCCF",
  },
  {
    id: "home",
    name: "Your space. Your strength.",
    subtitle: "Just you, a little space, and a fresh start.",
    category: "Bodyweight",
    minutes: 30,
    exercises: ["squat", "pushup", "bridge", "birddog", "lunge"],
    accent: "#E4E7D5",
  },
  {
    id: "core",
    name: "Strong at the center",
    subtitle: "A focused reset for your core.",
    category: "Core",
    minutes: 15,
    exercises: ["deadbug", "birddog", "bridge"],
    accent: "#EADBCB",
  },
  {
    id: "mobility",
    name: "Make room to move",
    subtitle: "Slow down. Open up. Feel better.",
    category: "Mobility",
    minutes: 12,
    exercises: ["catcow", "rotation", "wallslide"],
    accent: "#DDE4D8",
  },
  {
    id: "dumbbells",
    name: "Small setup. Big energy.",
    subtitle: "A complete session with one pair.",
    category: "Dumbbells",
    minutes: 30,
    exercises: ["goblet-squat", "row", "press", "rdl"],
    accent: "#DDDCCC",
  },
];
export const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const shortDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function adaptWorkout(workout: Workout, profile: Profile): Workout {
  if (workout.category === "Custom") {
    // A user-authored routine is explicit; never silently replace or truncate it.
    const custom = {
      ...workout,
      exercises: [...workout.exercises],
      prescription: workout.prescription?.map((target) => ({ ...target })),
    };
    return { ...custom, minutes: estimateWorkoutMinutes(custom, profile) };
  }
  const chosen: string[] = [];
  for (const id of workout.exercises) {
    const source = exerciseById(id);
    if (!source) continue;
    const samePattern = exerciseMetadata[id]?.pattern;
    const replacement = compatibleExercise(source, profile)
      ? source
      : exercises.find(
          (candidate) =>
            compatibleExercise(candidate, profile) &&
            !chosen.includes(candidate.id) &&
            exerciseMetadata[candidate.id]?.pattern === samePattern,
        );
    // Floor upper-back work is the limited no-equipment alternative for pulling.
    const fallback =
      replacement ??
      (profile.equipment === "Bodyweight" &&
      ["horizontal-pull", "vertical-pull"].includes(samePattern)
        ? exercises.find(
            (candidate) =>
              !chosen.includes(candidate.id) &&
              candidate.equipment === "Bodyweight" &&
              exerciseMetadata[candidate.id]?.pattern === "upper-back",
          )
        : undefined);
    if (fallback && !chosen.includes(fallback.id)) chosen.push(fallback.id);
  }
  const prepared: Workout = {
    ...workout,
    exercises: chosen,
    prescription: chosen.map(
      (id) =>
        workout.prescription?.find((target) => target.exerciseId === id) ??
        prescriptionForExercise(exerciseById(id), profile),
    ),
  };
  if (
    workout.category === "Strength" &&
    !workout.prescription &&
    profile.duration >= 60
  ) {
    for (const id of profile.equipment === "Bodyweight"
      ? ["calf", "heel-tap"]
      : ["lateral", "deadbug"]) {
      if (!chosen.includes(id)) {
        chosen.push(id);
        prepared.prescription!.push(
          prescriptionForExercise(exerciseById(id), profile),
        );
      }
    }
  }
  while (
    chosen.length > 1 &&
    estimateWorkoutMinutes(prepared, profile) > profile.duration
  ) {
    chosen.pop();
    prepared.prescription!.pop();
  }
  return { ...prepared, minutes: estimateWorkoutMinutes(prepared, profile) };
}
export function buildPlan(profile: Profile, history: WorkoutRecord[] = []) {
  return composePlan(profile, history);
}
export function createSession(
  workout: Workout,
  profile: Profile,
  history: WorkoutRecord[],
): ActiveWorkout {
  const prescription = workout.exercises.map(
    (id) =>
      workout.prescription?.find((target) => target.exerciseId === id) ??
      prescriptionForExercise(exerciseById(id), profile),
  );
  const orderedHistory = [...history].sort(
    (a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt),
  );
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workoutId: workout.id,
    name: workout.name,
    startedAt: new Date().toISOString(),
    exercises: [...workout.exercises],
    prescription: prescription.map((target) => ({ ...target })),
    unit: profile.unit,
    sets: prescription.flatMap((target) => {
      const previous = orderedHistory.find((record) =>
        record.sets.some(
          (set) => set.exerciseId === target.exerciseId && set.done,
        ),
      );
      return Array.from({ length: target.sets }, (_, index) => {
        const old = previous?.sets.find(
          (set) =>
            set.exerciseId === target.exerciseId &&
            set.index === index &&
            set.done,
        );
        return {
          exerciseId: target.exerciseId,
          index,
          reps:
            workout.category === "Custom"
              ? target.reps
              : old?.reps || target.reps,
          weight: old
            ? Math.round(
                old.weight *
                  (previous?.unit === profile.unit
                    ? 1
                    : profile.unit === "kg"
                      ? 0.45359237
                      : 2.20462262) *
                  10,
              ) / 10
            : 0,
          done: false,
        };
      });
    }),
  };
}
export function volumeKg(record: WorkoutRecord): number {
  return record.sets
    .filter((s) => s.done)
    .reduce(
      (sum, s) =>
        sum + s.reps * s.weight * (record.unit === "lb" ? 0.45359237 : 1),
      0,
    );
}
export function weekStart(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
export function weekHistory(history: WorkoutRecord[], date = new Date()) {
  const start = weekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return history.filter(
    (h) => new Date(h.completedAt) >= start && new Date(h.completedAt) < end,
  );
}
export function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== "object") return false;
  const v = value as AppState;
  const p = v.profile;
  return (
    v.version === 1 &&
    !!p &&
    typeof p.name === "string" &&
    ["Build strength", "Build muscle", "Feel fitter"].includes(p.goal) &&
    ["Full gym", "Dumbbells", "Bodyweight"].includes(p.equipment) &&
    ["Getting started", "Some experience", "Very experienced"].includes(
      p.experience,
    ) &&
    ["kg", "lb"].includes(p.unit) &&
    [30, 45, 60].includes(p.duration) &&
    typeof p.onboardingDone === "boolean" &&
    Array.isArray(p.days) &&
    p.days.length >= 2 &&
    p.days.length <= 5 &&
    new Set(p.days).size === p.days.length &&
    p.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) &&
    Array.isArray(v.history) &&
    v.history.every(
      (h) =>
        isSession(h) &&
        typeof h.completedAt === "string" &&
        Number.isFinite(Date.parse(h.completedAt)) &&
        Number.isFinite(h.durationSeconds) &&
        h.durationSeconds >= 0,
    ) &&
    Array.isArray(v.saved) &&
    v.saved.every((id) => typeof id === "string") &&
    (v.active === null || isSession(v.active))
  );
}
function isSession(v: ActiveWorkout) {
  return (
    !!v &&
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    Number.isFinite(Date.parse(v.startedAt)) &&
    ["kg", "lb"].includes(v.unit) &&
    Array.isArray(v.exercises) &&
    v.exercises.length > 0 &&
    v.exercises.every((id) => exercises.some((e) => e.id === id)) &&
    (v.prescription === undefined ||
      (Array.isArray(v.prescription) &&
        v.prescription.length === v.exercises.length &&
        v.prescription.every(
          (target) =>
            !!target &&
            v.exercises.includes(target.exerciseId) &&
            Number.isInteger(target.sets) &&
            target.sets >= 1 &&
            target.sets <= 10 &&
            Number.isInteger(target.reps) &&
            target.reps >= 1 &&
            target.reps <= 1000 &&
            Number.isInteger(target.restSeconds) &&
            target.restSeconds >= 0 &&
            target.restSeconds <= 600,
        ) &&
        new Set(v.prescription.map((target) => target.exerciseId)).size ===
          v.exercises.length)) &&
    Array.isArray(v.sets) &&
    v.sets.every(
      (s) =>
        !!s &&
        v.exercises.includes(s.exerciseId) &&
        Number.isInteger(s.index) &&
        s.index >= 0 &&
        Number.isFinite(s.reps) &&
        s.reps > 0 &&
        Number.isFinite(s.weight) &&
        s.weight >= 0 &&
        typeof s.done === "boolean",
    )
  );
}
