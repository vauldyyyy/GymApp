import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp, type AppOptions } from '../src/app.js';
import { sqliteDatabase } from '../src/database.js';
import { hashToken } from '../src/security.js';

async function fixture(options: Partial<AppOptions> = {}) {
  const database = options.database ?? sqliteDatabase();
  const app = await createApp({ database, webhookSecret: 'Bearer fixture-webhook-secret', authRateLimit: 1000, ...options });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  async function request(path: string, method = 'GET', body?: unknown, token?: string, headers: Record<string, string> = {}) {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const raw = await response.text();
    return { status: response.status, body: raw ? JSON.parse(raw) : null, headers: response.headers };
  }
  async function register(email = 'alex@example.test', name = 'Alex') {
    const response = await request('/api/auth/register', 'POST', { email, password: 'correct horse battery', name });
    assert.equal(response.status, 201);
    return response.body as { token: string; user: { id: string; email: string; name: string }; expiresAt: string };
  }
  return {
    database, request, register,
    async close() {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      await database.close();
    },
  };
}

test('registration, login, hashed credentials, normalized email, and revoked sessions', async () => {
  const f = await fixture();
  try {
    const account = await f.register('Alex@Example.Test');
    assert.equal(account.user.email, 'alex@example.test');
    assert.equal(account.user.name, 'Alex');
    assert.match(account.token, /^[A-Za-z0-9_-]{43}$/);
    const userRow = (await f.database.query('SELECT * FROM users')).rows[0]!;
    assert.match(String(userRow.password_hash), /^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    assert.equal(JSON.stringify(userRow).includes('correct horse battery'), false);
    const sessionRow = (await f.database.query('SELECT * FROM sessions')).rows[0]!;
    assert.equal(sessionRow.token_hash, hashToken(account.token));
    assert.equal(JSON.stringify(sessionRow).includes(account.token), false);
    const duplicate = await f.request('/api/auth/register', 'POST', { email: 'ALEX@example.test', password: 'other passcode', name: 'Other' });
    assert.equal(duplicate.status, 409);
    assert.equal((await f.request('/api/auth/login', 'POST', { email: account.user.email, password: 'incorrect password' })).status, 401);
    const loggedIn = await f.request('/api/auth/login', 'POST', { email: 'Alex@Example.Test', password: 'correct horse battery' });
    assert.equal(loggedIn.status, 200);
    assert.notEqual(loggedIn.body.token, account.token);
    assert.deepEqual(loggedIn.body.user, account.user);
    assert.deepEqual((await f.request('/api/auth/me', 'GET', undefined, account.token)).body.user, account.user);
    assert.equal((await f.request('/api/auth/logout', 'POST', undefined, account.token)).status, 204);
    assert.equal((await f.request('/api/profile', 'GET', undefined, account.token)).status, 401);
    assert.equal((await f.request('/api/profile', 'GET', undefined, loggedIn.body.token)).status, 200);
  } finally { await f.close(); }
});

test('personal profile and workout state are isolated by verified session identity', async () => {
  const f = await fixture();
  try {
    const alex = await f.register();
    const sam = await f.register('sam@example.test', 'Sam');
    const profile = { goal: 'strength', daysPerWeek: 3, equipment: ['dumbbells'] };
    const state = { sessions: [{ id: 'workout-1', sets: [{ weight: 30, reps: 8, completed: true }] }] };
    assert.equal((await f.request('/api/profile', 'PUT', { profile, userId: sam.user.id }, alex.token)).status, 200);
    assert.equal((await f.request('/api/workout-state', 'PUT', { state }, alex.token)).status, 200);
    assert.deepEqual((await f.request('/api/profile', 'GET', undefined, alex.token)).body.profile, profile);
    assert.deepEqual((await f.request('/api/workout-state', 'GET', undefined, alex.token)).body.state, state);
    assert.equal((await f.request('/api/profile', 'GET', undefined, sam.token)).body.profile, null);
    assert.equal((await f.request('/api/workout-state', 'GET', undefined, sam.token)).body.state, null);
    assert.equal((await f.request('/api/profile', 'GET', undefined, undefined, { 'x-user-id': alex.user.id })).status, 401);
    assert.equal((await f.request('/api/workout-state', 'GET', undefined, 'a'.repeat(43))).status, 401);
  } finally { await f.close(); }
});

test('validation, payload bounds, optimistic conflict detection, CORS, and session expiration', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request('/api/auth/register', 'POST', { email: 'invalid', name: 'Alex', password: '12345678' })).status, 400);
    assert.equal((await f.request('/api/auth/register', 'POST', { email: 'alex@example.test', name: 'Alex', password: 'short' })).status, 400);
    const { token } = await f.register();
    assert.equal((await f.request('/api/profile', 'PUT', { profile: [] }, token)).status, 400);
    assert.equal((await f.request('/api/profile', 'PUT', { profile: { note: 'a'.repeat(17_000) } }, token)).status, 413);
    const first = await f.request('/api/workout-state', 'PUT', { state: { revision: 1 }, expectedUpdatedAt: null }, token);
    assert.equal(first.status, 200);
    const second = await f.request('/api/workout-state', 'PUT', { state: { revision: 2 }, expectedUpdatedAt: first.body.updatedAt }, token);
    assert.equal(second.status, 200);
    const conflict = await f.request('/api/workout-state', 'PUT', { state: { revision: 3 }, expectedUpdatedAt: first.body.updatedAt }, token);
    assert.equal(conflict.status, 409);
    assert.equal((await f.request('/api/workout-state', 'GET', undefined, token)).body.state.revision, 2);
    const simultaneous = await Promise.all([
      f.request('/api/workout-state', 'PUT', { state: { revision: 3 }, expectedUpdatedAt: second.body.updatedAt }, token),
      f.request('/api/workout-state', 'PUT', { state: { revision: 4 }, expectedUpdatedAt: second.body.updatedAt }, token),
    ]);
    assert.deepEqual(simultaneous.map((response) => response.status).sort(), [200, 409]);
    assert.equal((await f.request('/health', 'GET', undefined, undefined, { Origin: 'https://untrusted.example' })).status, 403);
    const allowed = await f.request('/api/profile', 'OPTIONS', undefined, undefined, { Origin: 'http://localhost:8081' });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:8081');
    await f.database.query('UPDATE sessions SET expires_at = $1 WHERE token_hash = $2', [Date.now() - 1, hashToken(token)]);
    assert.equal((await f.request('/api/profile', 'GET', undefined, token)).status, 401);
  } finally { await f.close(); }
});

test('SQLite retains account and training state after an API/database restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'fitness-api-test-'));
  const file = join(directory, 'test.sqlite');
  let f = await fixture({ database: sqliteDatabase(file) });
  try {
    const account = await f.register();
    await f.request('/api/workout-state', 'PUT', { state: { activeWorkout: 'push-day', completedSets: 4 } }, account.token);
    await f.close();
    f = await fixture({ database: sqliteDatabase(file) });
    const saved = await f.request('/api/workout-state', 'GET', undefined, account.token);
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.state, { activeWorkout: 'push-day', completedSets: 4 });
  } finally {
    await f.close();
    // Delete only files created in the exact mkdtemp directory, without recursion.
    for (const entry of readdirSync(directory)) unlinkSync(join(directory, entry));
    rmdirSync(directory);
  }
});

function event(userId: string, override: Record<string, unknown> = {}) {
  return { event: {
    id: 'event-1', type: 'INITIAL_PURCHASE', app_user_id: userId, product_id: 'fitness_yearly',
    entitlement_ids: ['forma_pro'], expiration_at_ms: Date.now() + 86_400_000,
    event_timestamp_ms: Date.now(), period_type: 'NORMAL', environment: 'SANDBOX', ...override,
  } };
}
const webhookAuth = { Authorization: 'Bearer fixture-webhook-secret' };

test('RevenueCat authenticates webhooks, validates events, and keeps environments separate', async () => {
  const f = await fixture();
  try {
    const account = await f.register();
    assert.equal((await f.request('/api/revenuecat/webhook', 'POST', event(account.user.id))).status, 401);
    assert.equal((await f.request('/api/revenuecat/webhook', 'POST', { event: { id: 'bad' } }, undefined, webhookAuth)).status, 400);
    assert.equal((await f.request('/api/entitlements', 'GET', undefined, account.token)).body.isPro, false);
    const production = await f.request('/api/revenuecat/webhook', 'POST', event(account.user.id, { environment: 'PRODUCTION' }), undefined, webhookAuth);
    assert.equal(production.status, 200);
    assert.equal((await f.request('/api/entitlements', 'GET', undefined, account.token)).body.isPro, false);
    const sandbox = await f.request('/api/revenuecat/webhook', 'POST', event(account.user.id, { id: 'sandbox-1' }), undefined, webhookAuth);
    assert.equal(sandbox.status, 200);
    assert.equal((await f.request('/api/entitlements', 'GET', undefined, account.token)).body.isPro, true);
  } finally { await f.close(); }
  const disabled = await fixture({ webhookSecret: undefined });
  try { assert.equal((await disabled.request('/api/revenuecat/webhook', 'POST', {})).status, 503); }
  finally { await disabled.close(); }
});

test('RevenueCat delivery retries, cancellation, out-of-order events, expiry, and refunds preserve correct access', async () => {
  const f = await fixture();
  try {
    const account = await f.register();
    const at = Date.now();
    const post = (override: Record<string, unknown> = {}) => f.request('/api/revenuecat/webhook', 'POST', event(account.user.id, { event_timestamp_ms: at, ...override }), undefined, webhookAuth);
    const pro = async () => (await f.request('/api/entitlements', 'GET', undefined, account.token)).body.isPro;
    assert.equal((await post()).status, 200);
    assert.equal(await pro(), true);
    const retry = await post({ type: 'EXPIRATION' });
    assert.equal(retry.body.duplicate, true);
    assert.equal(await pro(), true);
    await post({ id: 'cancel-1', type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE', event_timestamp_ms: at + 10 });
    assert.equal(await pro(), true, 'turning off renewal must not remove the already-paid period');
    const stale = await post({ id: 'stale-expiry', type: 'EXPIRATION', event_timestamp_ms: at - 100 });
    assert.equal(stale.body.outcome, 'stale');
    assert.equal(await pro(), true);
    await post({ id: 'expired-1', type: 'EXPIRATION', entitlement_ids: undefined, event_timestamp_ms: at + 20 });
    assert.equal(await pro(), false);
    await post({ id: 'equal-time-cancellation', type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE', event_timestamp_ms: at + 20 });
    assert.equal(await pro(), false, 'same-timestamp cancellation cannot resurrect an expired product');
    await post({ id: 'renew-1', type: 'RENEWAL', event_timestamp_ms: at + 30 });
    assert.equal(await pro(), true);
    await post({ id: 'refund-1', type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', event_timestamp_ms: at + 40 });
    assert.equal(await pro(), false);
    await post({ id: 'another-product', product_id: 'fitness_monthly', event_timestamp_ms: at + 50 });
    assert.equal(await pro(), true);
    await post({ id: 'old-product-expiry', type: 'EXPIRATION', event_timestamp_ms: at + 60 });
    assert.equal(await pro(), true, 'expiry of one product must not revoke another active purchase');
    await f.database.query('UPDATE entitlements SET expires_at = $1', [Date.now() - 1]);
    assert.equal(await pro(), false, 'access expires by time even if a webhook is delayed');
    assert.equal((await f.database.query('SELECT id FROM webhook_events WHERE id = $1', ['event-1'])).rowCount, 1);
  } finally { await f.close(); }
});

test('authentication rate limits apply without exposing database or credential details', async () => {
  const f = await fixture({ authRateLimit: 2 });
  try {
    const credentials = { email: 'absent@example.test', password: 'wrong password' };
    assert.equal((await f.request('/api/auth/login', 'POST', credentials)).status, 401);
    assert.equal((await f.request('/api/auth/login', 'POST', credentials)).status, 401);
    const limited = await f.request('/api/auth/login', 'POST', credentials);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    assert.deepEqual((await f.request('/health')).body, { ok: true, service: 'fitness-api', database: 'sqlite' });
  } finally { await f.close(); }
});

test('account export requires a session, includes only its cloud data, and never includes credentials', async () => {
  const f = await fixture();
  try {
    const alex = await f.register();
    const sam = await f.register('sam@example.test', 'Sam');
    await f.request('/api/profile', 'PUT', { profile: { name: 'Alex', goal: 'strength' } }, alex.token);
    await f.request('/api/workout-state', 'PUT', { state: { sessions: [{ id: 'alex-workout' }] } }, alex.token);
    await f.request('/api/workout-state', 'PUT', { state: { sessions: [{ id: 'sam-private-workout' }] } }, sam.token);
    await f.request('/api/revenuecat/webhook', 'POST', event(alex.user.id), undefined, webhookAuth);
    assert.equal((await f.request('/api/account/export')).status, 401);
    const exported = await f.request('/api/account/export', 'GET', undefined, alex.token);
    assert.equal(exported.status, 200);
    assert.equal(exported.body.format, 'forma-account-export');
    assert.equal(exported.body.user.id, alex.user.id);
    assert.equal(exported.body.user.email, alex.user.email);
    assert.deepEqual(exported.body.profile.data, { name: 'Alex', goal: 'strength' });
    assert.deepEqual(exported.body.workoutState.data, { sessions: [{ id: 'alex-workout' }] });
    assert.equal(exported.body.subscriptions[0].entitlementId, 'forma_pro');
    assert.equal(exported.body.subscriptionEvents[0].id, 'event-1');
    assert.match(exported.headers.get('content-disposition') ?? '', /^attachment; filename="forma-account-\d{4}-\d{2}-\d{2}\.json"$/);
    assert.equal(exported.headers.get('cache-control'), 'no-store');
    const serialized = JSON.stringify(exported.body);
    for (const forbidden of ['password_hash', 'token_hash', alex.token, sam.token, 'correct horse battery', 'sam-private-workout', sam.user.email]) assert.equal(serialized.includes(forbidden), false);
    const other = await f.request('/api/account/export', 'GET', undefined, sam.token);
    assert.equal(other.body.profile, null);
    assert.deepEqual(other.body.subscriptions, []);
    assert.deepEqual(other.body.subscriptionEvents, []);
  } finally { await f.close(); }
});

test('account deletion rechecks the password and removes all owned records and sessions without affecting another account', async () => {
  const f = await fixture();
  try {
    const alex = await f.register();
    const sam = await f.register('sam@example.test', 'Sam');
    const anotherSession = await f.request('/api/auth/login', 'POST', { email: alex.user.email, password: 'correct horse battery' });
    await f.request('/api/profile', 'PUT', { profile: { name: 'Alex' } }, alex.token);
    await f.request('/api/workout-state', 'PUT', { state: { id: 'alex-private' } }, alex.token);
    await f.request('/api/workout-state', 'PUT', { state: { id: 'sam-private' } }, sam.token);
    await f.request('/api/revenuecat/webhook', 'POST', event(alex.user.id), undefined, webhookAuth);
    await f.request('/api/revenuecat/webhook', 'POST', event(sam.user.id, { id: 'sam-event' }), undefined, webhookAuth);
    assert.equal((await f.request('/api/account', 'DELETE', { password: 'correct horse battery' })).status, 401);
    assert.equal((await f.request('/api/account', 'DELETE', {}, alex.token)).status, 400);
    const wrong = await f.request('/api/account', 'DELETE', { password: 'wrong password' }, alex.token);
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error.code, 'invalid_credentials');
    assert.equal((await f.request('/api/account/export', 'GET', undefined, alex.token)).status, 200);
    // A body field cannot change the account selected by the authenticated token.
    const removed = await f.request('/api/account', 'DELETE', { password: 'correct horse battery', userId: sam.user.id }, alex.token);
    assert.equal(removed.status, 204);
    assert.equal(removed.body, null);
    for (const token of [alex.token, anotherSession.body.token]) assert.equal((await f.request('/api/account/export', 'GET', undefined, token)).status, 401);
    assert.equal((await f.request('/api/auth/login', 'POST', { email: alex.user.email, password: 'correct horse battery' })).status, 401);
    for (const [table, column] of [['users', 'id'], ['sessions', 'user_id'], ['user_documents', 'user_id'], ['entitlements', 'user_id'], ['webhook_events', 'app_user_id']]) {
      assert.equal((await f.database.query(`SELECT * FROM ${table} WHERE ${column} = $1`, [alex.user.id])).rowCount, 0);
    }
    assert.deepEqual((await f.request('/api/workout-state', 'GET', undefined, sam.token)).body.state, { id: 'sam-private' });
    assert.equal((await f.request('/api/entitlements', 'GET', undefined, sam.token)).body.isPro, true);
    // Later billing notifications cannot recreate the account or its identifier.
    const late = await f.request('/api/revenuecat/webhook', 'POST', event(alex.user.id, { id: 'late-after-delete', type: 'RENEWAL' }), undefined, webhookAuth);
    assert.equal(late.body.outcome, 'unknown_user');
    const logged = (await f.database.query('SELECT app_user_id FROM webhook_events WHERE id = $1', ['late-after-delete'])).rows[0];
    assert.equal(logged?.app_user_id, null);
    assert.equal((await f.database.query('SELECT id FROM users WHERE id = $1', [alex.user.id])).rowCount, 0);
    const preflight = await f.request('/api/account', 'OPTIONS', undefined, undefined, { Origin: 'http://localhost:8081' });
    assert.ok(preflight.headers.get('access-control-allow-methods')?.includes('DELETE'));
  } finally { await f.close(); }
});
