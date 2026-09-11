import assert from "node:assert/strict";
import test from "node:test";
import { createSession, estimateWorkoutMinutes } from "../src/data";
import { defaultProfile } from "../src/types";
import {
  CustomRoutine,
  deleteRoutine,
  duplicateRoutine,
  exerciseForRoutine,
  isCustomRoutine,
  mergeRoutines,
  parseRoutines,
  reorderRoutineExercise,
  routineStorageKey,
  routineToWorkout,
  serializeRoutines,
} from "../src/lib/routines";

function routine(overrides: Partial<CustomRoutine> = {}): CustomRoutine {
  return {
    id: "custom-test",
    name: "My upper day",
    minutes: 30,
    exercises: [exerciseForRoutine("bench-press"), exerciseForRoutine("row")],
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

test("routine caches reject a different owner and malformed prescriptions", () => {
  const original = routine();
  const raw = serializeRoutines([original], "account-a");
  assert.deepEqual(parseRoutines(raw, "account-a"), [original]);
  assert.equal(parseRoutines(raw, "account-b"), null);
  assert.equal(parseRoutines(raw, null), null);
  assert.notEqual(routineStorageKey(null), routineStorageKey("guest"));
  assert.equal(
    isCustomRoutine(
      routine({ exercises: [{ ...original.exercises[0], sets: 0 }] }),
    ),
    false,
  );
  assert.equal(
    isCustomRoutine(
      routine({
        exercises: [
          { ...original.exercises[0], exerciseId: "unknown-exercise" },
        ],
      }),
    ),
    false,
  );
  assert.equal(
    isCustomRoutine(
      routine({ exercises: [original.exercises[0], original.exercises[0]] }),
    ),
    false,
  );
  assert.equal(parseRoutines("{broken", null), null);
});

test("routine synchronization preserves newer edits and deletions regardless of merge order", () => {
  const old = routine();
  const edited = routine({ name: "Edited on phone", updatedAt: 300 });
  const removed = deleteRoutine(edited, 400);
  assert.deepEqual(mergeRoutines([old], [edited]), [edited]);
  assert.deepEqual(mergeRoutines([edited], [old]), [edited]);
  assert.deepEqual(mergeRoutines([removed], [old, edited]), [removed]);
  assert.deepEqual(mergeRoutines([old, edited], [removed]), [removed]);
  const sameTimestampLive = routine({ updatedAt: 400 });
  assert.deepEqual(mergeRoutines([sameTimestampLive], [removed]), [removed]);
  assert.deepEqual(mergeRoutines([removed], [sameTimestampLive]), [removed]);
});

test("custom routines keep exercise order and exact prescriptions in a real session", () => {
  const custom = routine({
    exercises: [
      { exerciseId: "bench-press", sets: 5, reps: 7, restSeconds: 150 },
      { exerciseId: "row", sets: 2, reps: 11, restSeconds: 45 },
    ],
  });
  const reversed = reorderRoutineExercise(custom, 1, 0);
  assert.deepEqual(
    reversed.exercises.map((exercise) => exercise.exerciseId),
    ["row", "bench-press"],
  );
  const workout = routineToWorkout(reversed);
  const session = createSession(workout, defaultProfile, []);
  assert.deepEqual(session.exercises, ["row", "bench-press"]);
  assert.equal(
    session.sets.filter((set) => set.exerciseId === "bench-press").length,
    5,
  );
  assert.ok(
    session.sets
      .filter((set) => set.exerciseId === "bench-press")
      .every((set) => set.reps === 7),
  );
  assert.equal(
    session.prescription?.find((entry) => entry.exerciseId === "row")
      ?.restSeconds,
    45,
  );
  assert.ok(estimateWorkoutMinutes(workout, defaultProfile) > 0);
});

test("duplicating a routine creates an independent editable record", () => {
  const source = routine();
  const copy = duplicateRoutine(source, 500);
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.name, "My upper day (copy)");
  copy.exercises[0].sets = 6;
  assert.notEqual(copy.exercises[0].sets, source.exercises[0].sets);
  assert.equal(copy.createdAt, 500);
  assert.equal(copy.deletedAt, undefined);
  assert.equal(isCustomRoutine(copy), true);
});
