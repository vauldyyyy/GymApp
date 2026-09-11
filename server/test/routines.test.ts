import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createApp, type AppOptions } from "../src/app.js";
import { sqliteDatabase } from "../src/database.js";
import { routineExerciseIds } from "../src/routines.js";
import { exercises } from "../../src/data.ts";

const localOrigin = { Origin: "http://localhost:8081" };
const sample = (overrides: Record<string, unknown> = {}) => ({
  id: "custom-test",
  name: "My upper day",
  minutes: 30,
  exercises: [{ exerciseId: "bench-press", sets: 3, reps: 8, restSeconds: 90 }],
  createdAt: 100,
  updatedAt: 200,
  ...overrides,
});

async function fixture(options: Partial<AppOptions> = {}) {
  const database = sqliteDatabase();
  const app = await createApp({
    database,
    webhookSecret: "Bearer routine-test-secret",
    authRateLimit: 1000,
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  async function request(
    path: string,
    method = "GET",
    body?: unknown,
    token?: string,
    headers: Record<string, string> = {},
  ) {
    const response = await fetch(url + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await response.text();
    return { status: response.status, body: raw ? JSON.parse(raw) : null };
  }
  async function register(email = "routine@example.test") {
    const result = await request("/api/auth/register", "POST", {
      email,
      name: "Studio tester",
      password: "correct horse battery",
    });
    assert.equal(result.status, 201);
    return result.body as { token: string; user: { id: string } };
  }
  async function paid(userId: string) {
    const result = await request(
      "/api/revenuecat/webhook",
      "POST",
      {
        event: {
          id: "routine-purchase-" + userId,
          type: "INITIAL_PURCHASE",
          app_user_id: userId,
          product_id: "forma_yearly",
          entitlement_ids: ["forma_pro"],
          expiration_at_ms: Date.now() + 86400000,
          event_timestamp_ms: Date.now(),
          period_type: "NORMAL",
          environment: "SANDBOX",
        },
      },
      undefined,
      { Authorization: "Bearer routine-test-secret" },
    );
    assert.equal(result.status, 200);
  }
  return {
    database,
    request,
    register,
    paid,
    async close() {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      await database.close();
    },
  };
}

test("routine API exercise contract matches the shipped library", () => {
  assert.deepEqual(
    [...routineExerciseIds].sort(),
    exercises.map((exercise) => exercise.id).sort(),
  );
});

test("routine access requires an authenticated owner and a real membership for production writes", async () => {
  const f = await fixture();
  try {
    const alex = await f.register();
    const sam = await f.register("sam-studio@example.test");
    assert.equal((await f.request("/api/routines")).status, 401);
    assert.deepEqual(
      (await f.request("/api/routines", "GET", undefined, alex.token)).body,
      { routines: [], updatedAt: null },
    );
    const body = { routines: [sample()], expectedUpdatedAt: null };
    assert.equal(
      (await f.request("/api/routines", "PUT", body, alex.token)).status,
      403,
    );
    assert.equal(
      (
        await f.request(
          "/api/routines",
          "PUT",
          { ...body, preview: true },
          alex.token,
          localOrigin,
        )
      ).status,
      403,
    );
    await f.paid(alex.user.id);
    const saved = await f.request(
      "/api/routines",
      "PUT",
      { ...body, userId: sam.user.id },
      alex.token,
    );
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.routines, [sample()]);
    assert.equal(typeof saved.body.updatedAt, "number");
    assert.deepEqual(
      (await f.request("/api/routines", "GET", undefined, sam.token)).body
        .routines,
      [],
    );
    assert.deepEqual(
      (await f.request("/api/routines", "GET", undefined, alex.token)).body
        .routines,
      [sample()],
    );
  } finally {
    await f.close();
  }
});

test("local preview needs explicit server opt-in and a loopback browser origin without granting entitlements", async () => {
  const f = await fixture({
    allowLocalPreview: true,
    allowedOrigins: ["https://review.example.test"],
  });
  try {
    const account = await f.register();
    const body = {
      routines: [sample()],
      expectedUpdatedAt: null,
      preview: true,
    };
    assert.equal(
      (await f.request("/api/routines", "PUT", body, account.token)).status,
      403,
    );
    assert.equal(
      (
        await f.request("/api/routines", "PUT", body, account.token, {
          Origin: "https://review.example.test",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request(
          "/api/routines",
          "PUT",
          { ...body, preview: false },
          account.token,
          localOrigin,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request(
          "/api/routines",
          "PUT",
          body,
          account.token,
          localOrigin,
        )
      ).status,
      200,
    );
    assert.equal(
      (await f.request("/api/entitlements", "GET", undefined, account.token))
        .body.isPro,
      false,
    );
  } finally {
    await f.close();
  }
});

test("routine writes reject stale updates, invalid exercise records and malformed tombstones", async () => {
  const f = await fixture({ allowLocalPreview: true });
  try {
    const { token } = await f.register();
    for (const invalid of [
      sample({ id: "not-a-custom-routine" }),
      sample({ deletedAt: 150 }),
      sample({
        exercises: [
          { exerciseId: "unknown-exercise", sets: 3, reps: 8, restSeconds: 90 },
        ],
      }),
      sample({
        exercises: [{ exerciseId: "row", sets: 0, reps: 8, restSeconds: 90 }],
      }),
    ])
      assert.equal(
        (
          await f.request(
            "/api/routines",
            "PUT",
            { routines: [invalid], expectedUpdatedAt: null, preview: true },
            token,
            localOrigin,
          )
        ).status,
        400,
      );
    const first = await f.request(
      "/api/routines",
      "PUT",
      { routines: [sample()], expectedUpdatedAt: null, preview: true },
      token,
      localOrigin,
    );
    assert.equal(first.status, 200);
    const requests = await Promise.all([
      f.request(
        "/api/routines",
        "PUT",
        {
          routines: [sample({ name: "Phone edit", updatedAt: 300 })],
          expectedUpdatedAt: first.body.updatedAt,
          preview: true,
        },
        token,
        localOrigin,
      ),
      f.request(
        "/api/routines",
        "PUT",
        {
          routines: [sample({ name: "Tablet edit", updatedAt: 301 })],
          expectedUpdatedAt: first.body.updatedAt,
          preview: true,
        },
        token,
        localOrigin,
      ),
    ]);
    assert.deepEqual(
      requests.map((response) => response.status).sort(),
      [200, 409],
    );
    assert.equal(
      (
        await f.request(
          "/api/routines",
          "PUT",
          { routines: [sample()], expectedUpdatedAt: null, preview: true },
          token,
          localOrigin,
        )
      ).status,
      409,
    );
  } finally {
    await f.close();
  }
});

test("lapsed members can read and delete but cannot edit, omit or resurrect routines", async () => {
  const f = await fixture({ allowLocalPreview: true });
  try {
    const { token } = await f.register();
    const initial = await f.request(
      "/api/routines",
      "PUT",
      { routines: [sample()], expectedUpdatedAt: null, preview: true },
      token,
      localOrigin,
    );
    assert.equal(initial.status, 200);
    assert.equal(
      (await f.request("/api/routines", "GET", undefined, token)).status,
      200,
    );
    for (const attempted of [
      [],
      [sample({ name: "Free edit", updatedAt: 300 })],
      [sample({ updatedAt: 150, deletedAt: 150 })],
      [sample(), sample({ id: "custom-added" })],
    ]) {
      assert.equal(
        (
          await f.request(
            "/api/routines",
            "PUT",
            { routines: attempted, expectedUpdatedAt: initial.body.updatedAt },
            token,
          )
        ).status,
        403,
      );
    }
    const tombstone = sample({ updatedAt: 400, deletedAt: 400 });
    const deleted = await f.request(
      "/api/routines",
      "PUT",
      { routines: [tombstone], expectedUpdatedAt: initial.body.updatedAt },
      token,
    );
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.body.routines, [tombstone]);
    assert.equal(
      (
        await f.request(
          "/api/routines",
          "PUT",
          {
            routines: [sample({ updatedAt: 500 })],
            expectedUpdatedAt: deleted.body.updatedAt,
          },
          token,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await f.request(
          "/api/routines",
          "PUT",
          {
            routines: [
              sample({ name: "Hidden edit", updatedAt: 500, deletedAt: 500 }),
            ],
            expectedUpdatedAt: deleted.body.updatedAt,
          },
          token,
        )
      ).status,
      403,
    );
  } finally {
    await f.close();
  }
});

test("routine export and account deletion preserve account isolation", async () => {
  const f = await fixture({ allowLocalPreview: true });
  try {
    const alex = await f.register();
    const sam = await f.register("export-other@example.test");
    for (const [account, name] of [
      [alex, "Alex private routine"],
      [sam, "Sam private routine"],
    ] as const) {
      assert.equal(
        (
          await f.request(
            "/api/routines",
            "PUT",
            {
              routines: [sample({ name })],
              expectedUpdatedAt: null,
              preview: true,
            },
            account.token,
            localOrigin,
          )
        ).status,
        200,
      );
    }
    const exported = await f.request(
      "/api/account/export",
      "GET",
      undefined,
      alex.token,
    );
    assert.equal(exported.status, 200);
    assert.equal(exported.body.routines.data[0].name, "Alex private routine");
    assert.equal(
      JSON.stringify(exported.body).includes("Sam private routine"),
      false,
    );
    assert.equal(
      (
        await f.request(
          "/api/account",
          "DELETE",
          { password: "correct horse battery" },
          alex.token,
        )
      ).status,
      204,
    );
    assert.equal(
      (
        await f.database.query(
          "SELECT user_id FROM routine_documents WHERE user_id = $1",
          [alex.user.id],
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (await f.request("/api/routines", "GET", undefined, alex.token)).status,
      401,
    );
    assert.equal(
      (await f.request("/api/routines", "GET", undefined, sam.token)).body
        .routines[0].name,
      "Sam private routine",
    );
  } finally {
    await f.close();
  }
});
