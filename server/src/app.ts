import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import type { Database, Row } from './database.js';
import { ApiError, email, password, record, route, text } from './http.js';
import { hashPassword, hashToken, newSessionToken, secretMatches, verifyPassword } from './security.js';
import { applyRevenueCatEvent, parseRevenueCatEvent, readEntitlements } from './entitlements.js';
import { registerRoutineRoutes } from './routines.js';

interface UserRow extends Row { id: string; email: string; name: string; password_hash: string }
interface SessionRow extends Row { user_id: string; expires_at: number | string }
interface DocumentRow extends Row { payload: string; updated_at: number | string }

export interface AppOptions {
  database: Database;
  webhookSecret?: string;
  allowedOrigins?: string[];
  allowLocalhost?: boolean;
  allowLocalPreview?: boolean;
  sessionDurationMs?: number;
  authRateLimit?: number;
  proEntitlement?: string;
  revenueCatEnvironment?: 'SANDBOX' | 'PRODUCTION';
}

export async function createApp(options: AppOptions) {
  const { database } = options;
  const app = express();
  const sessionDuration = options.sessionDurationMs ?? 30 * 24 * 60 * 60 * 1000;
  const origins = new Set(options.allowedOrigins ?? []);
  const authAttempts = new Map<string, { count: number; resetAt: number }>();
  const dummyPassword = await hashPassword(randomUUID());
  app.disable('x-powered-by');
  app.use(helmet());
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const local = options.allowLocalhost !== false && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
      if (!origins.has(origin) && !local) return next(new ApiError(403, 'origin_denied', 'This origin is not allowed.'));
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.vary('Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });
  app.use(express.json({ limit: '128kb', strict: true }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  app.get('/health', route(async (_req, res) => {
    await database.query('SELECT 1 AS ok');
    res.json({ ok: true, service: 'fitness-api', database: database.kind });
  }));

  const limitAuthentication: RequestHandler = (req, res, next) => {
    const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now();
    if (authAttempts.size > 10_000) {
      for (const [ip, bucket] of authAttempts) if (bucket.resetAt <= now) authAttempts.delete(ip);
    }
    const current = authAttempts.get(key);
    const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + 15 * 60_000 };
    bucket.count += 1;
    authAttempts.set(key, bucket);
    if (bucket.count > (options.authRateLimit ?? 30)) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return next(new ApiError(429, 'too_many_attempts', 'Too many authentication attempts. Try again in a few minutes.'));
    }
    next();
  };
  app.use(['/api/auth/register', '/api/auth/login'], limitAuthentication);

  async function issueSession(user: Pick<UserRow, 'id' | 'email' | 'name'>) {
    const token = newSessionToken();
    const now = Date.now();
    const expiresAt = now + sessionDuration;
    await database.query('DELETE FROM sessions WHERE expires_at <= $1', [now]);
    await database.query(
      'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES ($1, $2, $3, $4)',
      [hashToken(token), user.id, expiresAt, now],
    );
    return { token, user: { id: user.id, email: user.email, name: user.name }, expiresAt: new Date(expiresAt).toISOString() };
  }

  app.post('/api/auth/register', route(async (req, res) => {
    const body = record(req.body);
    const normalizedEmail = email(body.email);
    const userPassword = password(body.password);
    const name = text(body.name, 'Name', 1, 80);
    const existing = await database.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rowCount) throw new ApiError(409, 'email_in_use', 'An account with this email already exists. Sign in instead.');
    const user = { id: randomUUID(), email: normalizedEmail, name };
    const encoded = await hashPassword(userPassword);
    try {
      await database.query('INSERT INTO users (id, email, name, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)',
        [user.id, user.email, user.name, encoded, Date.now()]);
    } catch (error) {
      const problem = error as { code?: string; message?: string };
      if (problem.code === '23505' || problem.message?.includes('UNIQUE constraint failed: users.email')) {
        throw new ApiError(409, 'email_in_use', 'An account with this email already exists. Sign in instead.');
      }
      throw error;
    }
    res.status(201).json(await issueSession(user));
  }));

  app.post('/api/auth/login', route(async (req, res) => {
    const body = record(req.body);
    const normalizedEmail = email(body.email);
    const userPassword = password(body.password);
    const { rows } = await database.query<UserRow>('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = rows[0];
    const matches = await verifyPassword(userPassword, user?.password_hash ?? dummyPassword);
    if (!user || !matches) throw new ApiError(401, 'invalid_credentials', 'Email or password is incorrect.');
    res.json(await issueSession(user));
  }));

  app.post('/api/revenuecat/webhook', route(async (req, res) => {
    if (!options.webhookSecret) throw new ApiError(503, 'webhook_unconfigured', 'RevenueCat webhook is not configured.');
    if (!secretMatches(req.headers.authorization ?? '', options.webhookSecret)) throw new ApiError(401, 'invalid_webhook_auth', 'Invalid webhook authorization.');
    const event = parseRevenueCatEvent(req.body);
    res.json(await applyRevenueCatEvent(database, event));
  }));

  // All remaining API routes require an unexpired, server-issued session.
  app.use('/api', (req, res, next) => { void (async () => {
    const token = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(req.headers.authorization ?? '')?.[1];
    if (!token) throw new ApiError(401, 'unauthorized', 'Sign in to continue.');
    const { rows } = await database.query<SessionRow>('SELECT user_id, expires_at FROM sessions WHERE token_hash = $1', [hashToken(token)]);
    const session = rows[0];
    if (!session || Number(session.expires_at) <= Date.now()) throw new ApiError(401, 'session_expired', 'Your session has expired. Sign in again.');
    res.locals.userId = session.user_id;
    res.locals.tokenHash = hashToken(token);
    next();
  })().catch(next); });

  app.post('/api/auth/logout', route(async (_req, res) => {
    await database.query('DELETE FROM sessions WHERE token_hash = $1', [res.locals.tokenHash]);
    res.status(204).end();
  }));

  app.get('/api/auth/me', route(async (_req, res) => {
    const { rows } = await database.query<UserRow>('SELECT id, email, name FROM users WHERE id = $1', [res.locals.userId]);
    res.json({ user: rows[0] });
  }));

  app.get('/api/account/export', route(async (_req, res) => {
    const exported = await database.transaction(async (transaction) => {
      // Account-scoped writers also lock this row in PostgreSQL. A shared lock
      // gives the export a consistent snapshot while allowing parallel exports.
      const { rows } = await transaction.query<UserRow & { created_at: number | string }>(
        `SELECT id, email, name, created_at FROM users WHERE id = $1${database.kind === 'postgresql' ? ' FOR SHARE' : ''}`,
        [res.locals.userId],
      );
      const user = rows[0];
      if (!user) throw new ApiError(401, 'session_expired', 'This account is no longer available.');
      const documents = await transaction.query<DocumentRow & { kind: string }>('SELECT kind, payload, updated_at FROM user_documents WHERE user_id = $1', [user.id]);
      const routines = await transaction.query<DocumentRow>('SELECT payload, updated_at FROM routine_documents WHERE user_id = $1', [user.id]);
      const subscriptions = await transaction.query('SELECT entitlement_id, product_id, active, expires_at, period_type, environment, updated_at FROM entitlements WHERE user_id = $1 ORDER BY environment, entitlement_id, product_id', [user.id]);
      const events = await transaction.query('SELECT id, event_type, event_at, received_at, outcome FROM webhook_events WHERE app_user_id = $1 ORDER BY event_at', [user.id]);
      const document = (kind: string) => {
        const saved = documents.rows.find((item) => item.kind === kind);
        return saved ? { data: JSON.parse(saved.payload), updatedAt: new Date(Number(saved.updated_at)).toISOString() } : null;
      };
      const exportedAt = Date.now();
      return {
        format: 'forma-account-export', version: 1, exportedAt: new Date(exportedAt).toISOString(),
        user: { id: user.id, email: user.email, name: user.name, createdAt: new Date(Number(user.created_at)).toISOString() },
        profile: document('profile'), workoutState: document('workout-state'),
        routines: routines.rows[0] ? { data: JSON.parse(routines.rows[0].payload), updatedAt: Number(routines.rows[0].updated_at) } : null,
        subscriptions: subscriptions.rows.map((item) => ({
          entitlementId: item.entitlement_id, productId: item.product_id,
          active: Number(item.active) === 1 && (item.expires_at === null || Number(item.expires_at) > exportedAt),
          expiresAt: item.expires_at === null ? null : new Date(Number(item.expires_at)).toISOString(),
          periodType: item.period_type, environment: item.environment,
          updatedAt: new Date(Number(item.updated_at)).toISOString(),
        })),
        subscriptionEvents: events.rows.map((item) => ({
          id: item.id, type: item.event_type, eventAt: new Date(Number(item.event_at)).toISOString(),
          receivedAt: new Date(Number(item.received_at)).toISOString(), outcome: item.outcome,
        })),
        scope: 'Cloud data saved to this FORMA account. Workouts saved only on a device are not included.',
      };
    });
    res.setHeader('Content-Disposition', `attachment; filename="forma-account-${exported.exportedAt.slice(0, 10)}.json"`);
    res.json(exported);
  }));

  app.delete('/api/account', limitAuthentication, route(async (req, res) => {
    const supplied = password(record(req.body).password);
    const { rows } = await database.query<UserRow>('SELECT id, password_hash FROM users WHERE id = $1', [res.locals.userId]);
    const user = rows[0];
    if (!user || !(await verifyPassword(supplied, user.password_hash))) throw new ApiError(401, 'invalid_credentials', 'Your password is incorrect. Your account has not been deleted.');
    await database.transaction(async (transaction) => {
      if (database.kind === 'postgresql') await transaction.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);
      const session = await transaction.query('SELECT user_id FROM sessions WHERE token_hash = $1 AND user_id = $2 AND expires_at > $3', [res.locals.tokenHash, user.id, Date.now()]);
      if (!session.rowCount) throw new ApiError(401, 'session_expired', 'Your session has expired. Sign in again before deleting your account.');
      // Webhook logs have no foreign key because they can arrive before an
      // account exists. Remove these explicitly; all private tables cascade.
      await transaction.query('DELETE FROM webhook_events WHERE app_user_id = $1', [user.id]);
      await transaction.query('DELETE FROM users WHERE id = $1', [user.id]);
    });
    // This removes FORMA account data only. Store subscriptions and RevenueCat
    // customer records are separate services; no cancellation is claimed here.
    res.status(204).end();
  }));

  for (const kind of ['profile', 'workout-state'] as const) {
    const field = kind === 'profile' ? 'profile' : 'state';
    app.get(`/api/${kind}`, route(async (_req, res) => {
      const { rows } = await database.query<DocumentRow>('SELECT payload, updated_at FROM user_documents WHERE user_id = $1 AND kind = $2', [res.locals.userId, kind]);
      const document = rows[0];
      res.json({ [field]: document ? JSON.parse(document.payload) : null, updatedAt: document ? new Date(Number(document.updated_at)).toISOString() : null });
    }));
    app.put(`/api/${kind}`, route(async (req, res) => {
      const body = record(req.body);
      const value = record(body[field], field === 'profile' ? 'Profile' : 'Workout state');
      const payload = JSON.stringify(value);
      if (Buffer.byteLength(payload) > (kind === 'profile' ? 16_384 : 102_400)) {
        throw new ApiError(413, 'document_too_large', `${field === 'profile' ? 'Profile' : 'Workout state'} exceeds its storage limit.`);
      }
      if (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== null && (typeof body.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(body.expectedUpdatedAt)))) {
        throw new ApiError(400, 'invalid_input', 'expectedUpdatedAt must be a valid ISO date or null.');
      }
      const updatedAt = await database.transaction(async (transaction) => {
        // Serialize updates for an account across PostgreSQL connections so
        // expectedUpdatedAt remains a real compare-and-set, including creation.
        if (database.kind === 'postgresql') await transaction.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [res.locals.userId]);
        const { rows } = await transaction.query<DocumentRow>('SELECT payload, updated_at FROM user_documents WHERE user_id = $1 AND kind = $2', [res.locals.userId, kind]);
        const existing = rows[0];
        const previous = existing ? new Date(Number(existing.updated_at)).toISOString() : null;
        if (body.expectedUpdatedAt !== undefined && body.expectedUpdatedAt !== previous) {
          throw new ApiError(409, 'sync_conflict', 'A newer version is saved. Refresh before uploading your changes.');
        }
        const timestamp = Math.max(Date.now(), existing ? Number(existing.updated_at) + 1 : 0);
        await transaction.query(
          `INSERT INTO user_documents (user_id, kind, payload, updated_at) VALUES ($1, $2, $3, $4)
           ON CONFLICT (user_id, kind) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
          [res.locals.userId, kind, payload, timestamp],
        );
        return new Date(timestamp).toISOString();
      });
      res.json({ [field]: value, updatedAt });
    }));
  }

  app.get('/api/entitlements', route(async (_req, res) => {
    res.json(await readEntitlements(database, res.locals.userId, options.proEntitlement ?? 'forma_pro', options.revenueCatEnvironment ?? 'SANDBOX'));
  }));

  registerRoutineRoutes(app, database, options);

  app.use((_req, _res, next) => next(new ApiError(404, 'not_found', 'This endpoint does not exist.')));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
    const bodyError = error as { type?: string; status?: number };
    if (bodyError.type === 'entity.too.large') { res.status(413).json({ error: { code: 'body_too_large', message: 'Request body is too large.' } }); return; }
    if (error instanceof SyntaxError && bodyError.status === 400) { res.status(400).json({ error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } }); return; }
    console.error('[api] Request failed:', error instanceof Error ? error.name : 'Unknown error');
    res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong. Please try again.' } });
  });
  return app;
}
