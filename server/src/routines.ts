import type { Express, Request } from "express";
import type { Database, Row } from "./database.js";
import { ApiError, record, route, text } from "./http.js";
import { readEntitlements } from "./entitlements.js";

type Routine = {
  id: string;
  name: string;
  minutes: number;
  exercises: {
    exerciseId: string;
    sets: number;
    reps: number;
    restSeconds: number;
  }[];
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
};
interface DocumentRow extends Row {
  payload: string;
  updated_at: number | string;
}
// Kept in contract with the shipped exercise library by routines.test.ts.
export const routineExerciseIds = new Set([
  "goblet-squat",
  "bench-press",
  "row",
  "rdl",
  "press",
  "lunge",
  "squat",
  "pushup",
  "bridge",
  "deadbug",
  "birddog",
  "calf",
  "pulldown",
  "legpress",
  "cable-row",
  "curl",
  "lateral",
  "catcow",
  "rotation",
  "wallslide",
  "stepup",
  "triceps",
  "floor-press",
  "split-squat",
  "dumbbell-deadlift",
  "hammer-curl",
  "overhead-triceps",
  "chest-press-machine",
  "hamstring-curl",
  "leg-extension",
  "face-pull",
  "standing-cable-press",
  "kneeling-pushup",
  "full-pushup",
  "pike-pushup",
  "single-leg-bridge",
  "prone-y-raise",
  "reverse-snow-angel",
  "standing-hip-hinge",
  "heel-tap",
]);
const integer = (value: unknown, min: number, max: number) =>
  typeof value === "number" &&
  Number.isSafeInteger(value) &&
  value >= min &&
  value <= max;

function parseRoutines(value: unknown): Routine[] {
  if (!Array.isArray(value) || value.length > 100)
    throw new ApiError(
      400,
      "invalid_input",
      "Provide no more than 100 routines.",
    );
  const ids = new Set<string>();
  return value.map((raw) => {
    const item = record(raw, "Routine");
    const id = text(item.id, "Routine ID", 1, 100);
    if (!/^custom-[A-Za-z0-9-]{1,85}$/.test(id) || ids.has(id))
      throw new ApiError(
        400,
        "invalid_input",
        "Routine IDs must be unique and valid.",
      );
    ids.add(id);
    const name = text(item.name, "Routine name", 1, 60);
    if (
      ![30, 45, 60].includes(item.minutes as number) ||
      !integer(item.createdAt, 1, Number.MAX_SAFE_INTEGER) ||
      !integer(
        item.updatedAt,
        item.createdAt as number,
        Number.MAX_SAFE_INTEGER,
      ) ||
      (item.deletedAt !== undefined &&
        !integer(
          item.deletedAt,
          item.updatedAt as number,
          Number.MAX_SAFE_INTEGER,
        ))
    )
      throw new ApiError(400, "invalid_input", "Routine timing is invalid.");
    if (
      !Array.isArray(item.exercises) ||
      !item.exercises.length ||
      item.exercises.length > 12
    )
      throw new ApiError(
        400,
        "invalid_input",
        "Choose between 1 and 12 exercises.",
      );
    const exerciseIds = new Set<string>();
    const exercises = item.exercises.map((rawExercise) => {
      const e = record(rawExercise, "Exercise");
      const exerciseId = text(e.exerciseId, "Exercise ID", 1, 80);
      if (
        !routineExerciseIds.has(exerciseId) ||
        exerciseIds.has(exerciseId) ||
        !integer(e.sets, 1, 8) ||
        !integer(e.reps, 1, 50) ||
        !integer(e.restSeconds, 0, 300)
      )
        throw new ApiError(
          400,
          "invalid_input",
          "Each exercise needs a unique ID and valid sets, reps and rest.",
        );
      exerciseIds.add(exerciseId);
      return {
        exerciseId,
        sets: e.sets as number,
        reps: e.reps as number,
        restSeconds: e.restSeconds as number,
      };
    });
    return {
      id,
      name,
      minutes: item.minutes as number,
      exercises,
      createdAt: item.createdAt as number,
      updatedAt: item.updatedAt as number,
      ...(item.deletedAt !== undefined
        ? { deletedAt: item.deletedAt as number }
        : {}),
    };
  });
}

function previewAllowed(req: Request, enabled: boolean): boolean {
  return (
    enabled &&
    req.body?.preview === true &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
      req.socket.remoteAddress ?? "",
    ) &&
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(
      req.headers.origin ?? "",
    )
  );
}

// Lapsed subscribers retain their data and can remove it. A deletion-only
// upload cannot add, edit, resurrect or silently omit an existing routine.
function deletionOnly(next: Routine[], previous: Routine[]): boolean {
  if (next.length !== previous.length) return false;
  return next.every((item) => {
    const old = previous.find((entry) => entry.id === item.id);
    if (!old) return false;
    if (JSON.stringify(item) === JSON.stringify(old)) return true;
    if (
      !item.deletedAt ||
      item.updatedAt < old.updatedAt ||
      (!old.deletedAt && item.deletedAt <= old.updatedAt) ||
      (old.deletedAt && item.deletedAt < old.deletedAt)
    )
      return false;
    const { updatedAt: _u, deletedAt: _d, ...content } = item;
    const { updatedAt: _ou, deletedAt: _od, ...oldContent } = old;
    return JSON.stringify(content) === JSON.stringify(oldContent);
  });
}

export function registerRoutineRoutes(
  app: Express,
  database: Database,
  options: {
    allowLocalPreview?: boolean;
    proEntitlement?: string;
    revenueCatEnvironment?: "SANDBOX" | "PRODUCTION";
  },
) {
  app.get(
    "/api/routines",
    route(async (_req, res) => {
      const { rows } = await database.query<DocumentRow>(
        "SELECT payload, updated_at FROM routine_documents WHERE user_id = $1",
        [res.locals.userId],
      );
      const saved = rows[0];
      res.json({
        routines: saved ? JSON.parse(saved.payload) : [],
        updatedAt: saved ? Number(saved.updated_at) : null,
      });
    }),
  );
  app.put(
    "/api/routines",
    route(async (req, res) => {
      const body = record(req.body);
      const routines = parseRoutines(body.routines);
      if (
        body.expectedUpdatedAt !== null &&
        !integer(body.expectedUpdatedAt, 1, Number.MAX_SAFE_INTEGER)
      )
        throw new ApiError(
          400,
          "invalid_input",
          "expectedUpdatedAt must be a timestamp or null.",
        );
      const payload = JSON.stringify(routines);
      if (Buffer.byteLength(payload) > 102400)
        throw new ApiError(
          413,
          "document_too_large",
          "Your routine library exceeds its storage limit.",
        );
      const paid = await readEntitlements(
        database,
        res.locals.userId,
        options.proEntitlement ?? "forma_pro",
        options.revenueCatEnvironment ?? "SANDBOX",
      );
      const mayEdit =
        paid.isPro || previewAllowed(req, options.allowLocalPreview === true);
      const updatedAt = await database.transaction(async (transaction) => {
        if (database.kind === "postgresql")
          await transaction.query(
            "SELECT id FROM users WHERE id = $1 FOR UPDATE",
            [res.locals.userId],
          );
        const { rows } = await transaction.query<DocumentRow>(
          "SELECT payload, updated_at FROM routine_documents WHERE user_id = $1",
          [res.locals.userId],
        );
        const old = rows[0];
        const previous = old ? Number(old.updated_at) : null;
        if (body.expectedUpdatedAt !== previous)
          throw new ApiError(
            409,
            "sync_conflict",
            "Your routine library changed on another device. Refresh and retry.",
          );
        if (
          !mayEdit &&
          !deletionOnly(routines, old ? JSON.parse(old.payload) : [])
        )
          throw new ApiError(
            403,
            "membership_required",
            "FORMA Plus is required to create or edit cloud routines. Your saved routines remain available to read or delete.",
          );
        const timestamp = Math.max(Date.now(), (previous ?? 0) + 1);
        await transaction.query(
          "INSERT INTO routine_documents (user_id, payload, updated_at) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at",
          [res.locals.userId, payload, timestamp],
        );
        return timestamp;
      });
      res.json({ routines, updatedAt });
    }),
  );
}
