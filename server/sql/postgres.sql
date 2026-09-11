-- Production schema. Mirrors src/schema.ts; timestamps are UTC epoch ms.
-- The API applies this idempotent initial schema on startup.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS user_documents (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('profile', 'workout-state')),
  payload TEXT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY(user_id, kind)
);
CREATE TABLE IF NOT EXISTS routine_documents (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS entitlements (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entitlement_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  expires_at BIGINT,
  period_type TEXT,
  environment TEXT NOT NULL,
  last_event_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY(user_id, entitlement_id, product_id, environment)
);
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  app_user_id TEXT,
  event_at BIGINT NOT NULL,
  received_at BIGINT NOT NULL,
  outcome TEXT NOT NULL
);
