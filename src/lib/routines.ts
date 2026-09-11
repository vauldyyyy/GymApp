import { exercises } from "../data";
import { Workout } from "../types";

export type RoutineExercise = {
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
};

export type CustomRoutine = {
  id: string;
  name: string;
  minutes: 30 | 45 | 60;
  exercises: RoutineExercise[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};

export const MAX_ROUTINES = 100;
export const MAX_ROUTINE_EXERCISES = 12;
const knownExercises = new Set(exercises.map((exercise) => exercise.id));
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= min &&
  value <= max;

export function isCustomRoutine(value: unknown): value is CustomRoutine {
  if (!value || typeof value !== "object") return false;
  const routine = value as CustomRoutine;
  return (
    typeof routine.id === "string" &&
    /^custom-[A-Za-z0-9-]{1,85}$/.test(routine.id) &&
    typeof routine.name === "string" &&
    routine.name.trim().length > 0 &&
    routine.name.length <= 60 &&
    [30, 45, 60].includes(routine.minutes) &&
    integer(routine.createdAt, 1, Number.MAX_SAFE_INTEGER) &&
    integer(routine.updatedAt, routine.createdAt, Number.MAX_SAFE_INTEGER) &&
    (routine.deletedAt === undefined ||
      integer(routine.deletedAt, routine.updatedAt, Number.MAX_SAFE_INTEGER)) &&
    Array.isArray(routine.exercises) &&
    routine.exercises.length >= 1 &&
    routine.exercises.length <= MAX_ROUTINE_EXERCISES &&
    new Set(routine.exercises.map((exercise) => exercise?.exerciseId)).size ===
      routine.exercises.length &&
    routine.exercises.every(
      (exercise) =>
        !!exercise &&
        knownExercises.has(exercise.exerciseId) &&
        integer(exercise.sets, 1, 8) &&
        integer(exercise.reps, 1, 50) &&
        integer(exercise.restSeconds, 0, 300),
    )
  );
}

export function isRoutineList(value: unknown): value is CustomRoutine[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_ROUTINES &&
    value.every(isCustomRoutine) &&
    new Set(value.map((routine) => routine.id)).size === value.length
  );
}

export function routineStorageKey(ownerId: string | null): string {
  return (
    "forma-routines-v1:" + (ownerId === null ? "guest" : "account:" + ownerId)
  );
}

export function serializeRoutines(
  routines: CustomRoutine[],
  ownerId: string | null,
): string {
  if (!isRoutineList(routines))
    throw new Error(
      "The routine could not be saved. Check its exercises and try again.",
    );
  return JSON.stringify({ version: 1, ownerId, routines });
}

export function parseRoutines(
  raw: string | null,
  ownerId: string | null,
): CustomRoutine[] | null {
  if (raw === null) return [];
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!envelope || typeof envelope !== "object") return null;
    const cache = envelope as {
      version?: number;
      ownerId?: string | null;
      routines?: unknown;
    };
    return cache.version === 1 &&
      cache.ownerId === ownerId &&
      isRoutineList(cache.routines)
      ? cache.routines
      : null;
  } catch {
    return null;
  }
}

/** Tombstones are retained so another device cannot bring a deleted routine back. */
export function mergeRoutines(
  left: CustomRoutine[],
  right: CustomRoutine[],
): CustomRoutine[] {
  const merged = new Map<string, CustomRoutine>();
  for (const routine of [...left, ...right]) {
    const previous = merged.get(routine.id);
    const modified = Math.max(routine.updatedAt, routine.deletedAt || 0);
    const previousModified = previous
      ? Math.max(previous.updatedAt, previous.deletedAt || 0)
      : -1;
    if (
      !previous ||
      modified > previousModified ||
      (modified === previousModified &&
        (Boolean(routine.deletedAt) > Boolean(previous.deletedAt) ||
          (Boolean(routine.deletedAt) === Boolean(previous.deletedAt) &&
            JSON.stringify(routine) > JSON.stringify(previous))))
    ) {
      merged.set(routine.id, routine);
    }
  }
  const result = [...merged.values()].sort((a, b) => a.id.localeCompare(b.id));
  if (result.length > MAX_ROUTINES)
    throw new Error(
      "Your routine library is full. Your saved routines are safe; contact support before adding more.",
    );
  return result;
}

export function newRoutine(now = Date.now()): CustomRoutine {
  return {
    id:
      "custom-" +
      now.toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10),
    name: "",
    minutes: 45,
    exercises: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function exerciseForRoutine(exerciseId: string): RoutineExercise {
  const exercise = exercises.find((item) => item.id === exerciseId);
  if (!exercise) throw new Error("This exercise is not in your library.");
  return {
    exerciseId,
    sets: Math.min(8, Math.max(1, exercise.sets)),
    reps: Math.min(50, Math.max(1, Number.parseInt(exercise.reps, 10) || 10)),
    restSeconds: Math.min(300, Math.max(0, exercise.rest)),
  };
}

export function duplicateRoutine(
  routine: CustomRoutine,
  now = Date.now(),
): CustomRoutine {
  const copy = newRoutine(now);
  return {
    ...copy,
    name: (routine.name.slice(0, 53) + " (copy)").slice(0, 60),
    minutes: routine.minutes,
    exercises: routine.exercises.map((exercise) => ({ ...exercise })),
  };
}

export function deleteRoutine(
  routine: CustomRoutine,
  now = Date.now(),
): CustomRoutine {
  const timestamp = Math.max(
    now,
    routine.updatedAt + 1,
    (routine.deletedAt || 0) + 1,
  );
  return { ...routine, updatedAt: timestamp, deletedAt: timestamp };
}

export function reorderRoutineExercise(
  routine: CustomRoutine,
  from: number,
  to: number,
): CustomRoutine {
  if (
    from < 0 ||
    to < 0 ||
    from >= routine.exercises.length ||
    to >= routine.exercises.length ||
    from === to
  )
    return routine;
  const reordered = [...routine.exercises];
  const [exercise] = reordered.splice(from, 1);
  reordered.splice(to, 0, exercise);
  return { ...routine, exercises: reordered };
}

export function routineToWorkout(routine: CustomRoutine): Workout {
  return {
    id: routine.id,
    name: routine.name,
    subtitle: "Your custom routine",
    category: "Custom",
    minutes: routine.minutes,
    exercises: routine.exercises.map((exercise) => exercise.exerciseId),
    accent: "#E7EBDD",
    prescription: routine.exercises.map((exercise) => ({ ...exercise })),
    reasoning: [
      "Your exercise order, sets, reps and rest periods.",
      "Previous logged weights carry forward when you train.",
    ],
  };
}
