# Backend setup and API contract

The API is implemented in `server/`. It runs locally with SQLite on Node 22.13+ and supports PostgreSQL through `pg` when `DATABASE_URL` is supplied. Node 22 currently prints an experimental-module warning for its built-in SQLite driver; the local persistence and restart tests exercise that driver directly.

## Run locally

From the project root:

```powershell
cd server
npm install
npm start
```

The default URL is `http://127.0.0.1:4000`; `GET /health` verifies the database connection. The SQLite database is created at `server/data/forma.sqlite` and persists across restarts. `npm run dev` enables reload during development. All commands below are run from `server/` unless noted.

```powershell
npm run typecheck
npm test
npm run build
```

The app can operate locally without signing in. Cloud synchronization uses a real account and API session; it does not accept a local device ID as authentication. Set the frontend API URL to this API when enabling account sync. For a physical device on your network, set `HOST=0.0.0.0` in `server/.env` and use your computer's LAN address in the client.

## Configuration

Copy `server/.env.example` to `server/.env` to configure your own services. This repository does not supply existing apps' credentials.

| Variable | Purpose |
|---|---|
| `PORT`, `HOST` | API listening address; defaults to `4000`, `127.0.0.1` locally |
| `SQLITE_PATH` | Development database path; ignored when `DATABASE_URL` exists |
| `DATABASE_URL` | PostgreSQL connection string; mandatory in production |
| `NODE_ENV` | `production` disables automatic localhost CORS and requires PostgreSQL |
| `ALLOWED_ORIGINS` | Comma-separated exact browser origins; no wildcard matching |
| `SESSION_DAYS` | Session lifetime, default 30 days |
| `REVENUECAT_WEBHOOK_AUTH` | Exact Authorization header configured for the new RevenueCat webhook; absent means webhook returns 503 |
| `REVENUECAT_PRO_ENTITLEMENT` | Entitlement ID used to calculate `isPro`; defaults to `forma_pro` |
| `REVENUECAT_ENVIRONMENT` | `SANDBOX` locally; `PRODUCTION` by default in production |

Native apps with no Origin header are supported. During development, browser origins on localhost and loopback addresses are allowed. Production only allows origins explicitly listed in `ALLOWED_ORIGINS`. Serve production through HTTPS.

## Authentication

`POST /api/auth/register`

```json
{"email":"alex@example.com","password":"your chosen password","name":"Alex"}
```

`POST /api/auth/login`

```json
{"email":"alex@example.com","password":"your chosen password"}
```

Both return the following shape; registration uses HTTP 201 and login uses HTTP 200:

```json
{
  "token": "opaque session token",
  "user": {"id":"server-generated UUID","email":"alex@example.com","name":"Alex"},
  "expiresAt": "ISO 8601 timestamp"
}
```

Send `Authorization: Bearer <token>` on every private route. Tokens contain 256 random bits and only their SHA-256 hashes are stored. Passwords use per-password salts and scrypt. Email addresses are normalized to lowercase. Passwords require 8–256 characters; names require 1–80 characters. Thirty authentication attempts per IP per 15 minutes are allowed by the local process limiter.

- `GET /api/auth/me` returns `{ "user": { "id", "email", "name" } }`.
- `POST /api/auth/logout` revokes the current session and returns 204.
- Expired, invalid, or revoked sessions return 401. A guessed account/device header cannot substitute for a session.

There is no email-verification or password-recovery service yet; registration does not claim that an email address has been verified. Those flows need an email provider before public launch.

## Account export and deletion

`GET /api/account/export` requires the current Bearer session. It returns a JSON attachment named `forma-account-YYYY-MM-DD.json` with:

- `format: "forma-account-export"`, `version: 1`, and `exportedAt`.
- `user`: account ID, email, name, and creation timestamp.
- `profile` and `workoutState`: `{ "data": object, "updatedAt": ISO-date }`, or null when nothing has been saved.
- `subscriptions` and `subscriptionEvents`: the account's stored purchase entitlement/event records.

Passwords, password hashes, session tokens, and session hashes are excluded. The export covers cloud data only; workouts that have never synchronized from a device are not included. Every export is scoped to the authenticated account and uses `Cache-Control: no-store`.

`DELETE /api/account` requires both the current Bearer session and the account password:

```json
{"password":"your account password"}
```

Success returns HTTP 204. A wrong password returns 401 `invalid_credentials` and leaves all records unchanged. The deletion transaction explicitly removes that account's webhook log rows, deletes the user, and cascades to every session, profile/workout document, and entitlement. All of the deleted account's sessions become unusable. Other accounts are unaffected. A late billing webhook cannot recreate the account or retain its deleted account ID; only event deduplication metadata remains.

The client exposes `deleteAccount(password)` through its store. It completes the server request before clearing local ownership-scoped caches and recovery copies, removes the saved session, and signs out of the native billing identity. Guest and other-account caches remain separate. Network failure or an incorrect password leaves current local data in place. If device cleanup fails after server deletion succeeds, the user receives an explicit cleanup message; the deleted account cannot upload again.

Account deletion does **not** cancel an App Store or Google Play subscription, and the API makes no external RevenueCat customer-deletion request. Subscription management and any third-party privacy-erasure integration must be configured separately. The confirmation UI should state that store subscriptions are managed separately. No email or external account actions were performed while implementing these routes.

## Personal data

| Endpoint | Read response | Write request |
|---|---|---|
| `GET/PUT /api/profile` | `{ "profile": object-or-null, "updatedAt": ISO-date-or-null }` | `{ "profile": object }` |
| `GET/PUT /api/workout-state` | `{ "state": object-or-null, "updatedAt": ISO-date-or-null }` | `{ "state": object }` |

Writes return the saved object and its updated timestamp. Profile JSON is limited to 16 KiB; workout JSON to 100 KiB; the entire request to 128 KiB. These are private, account-scoped JSON records. The API always derives the account from the verified session, never a user ID supplied in the body. User records are initially empty, so onboarding/local state remains useful before the first upload.

Both write endpoints optionally accept `expectedUpdatedAt`. Send the timestamp from the previous read, or `null` when creating the first record. A mismatch returns 409 `sync_conflict` so an older device cannot silently replace newer data. Without this field, the most recently accepted write wins. Keep an active workout locally and upload only after local persistence succeeds.

`GET /api/entitlements` returns:

```json
{"entitlements":[],"isPro":false}
```

An active entry has `{ "id", "productId", "expiresAt", "periodType" }`; expiry is an ISO date or null for a lifetime purchase. Records from a different store environment are excluded. Expired records stop granting access even when the expiry webhook is delayed.

All errors use `{ "error": { "code": "machine_readable_code", "message": "Readable explanation" } }`. Important statuses: 400 invalid input, 401 sign-in required, 403 disallowed browser origin, 409 conflicting email/version, 413 excessive payload, 429 authentication limit, 503 unconfigured webhook.

## RevenueCat integration

Create a new RevenueCat project, app store products, offering, and `forma_pro` entitlement. Use the authenticated server user UUID as the RevenueCat app user ID when logging in to the native purchase SDK. Configure its webhook to `https://your-api.example/api/revenuecat/webhook` with the exact Authorization value from `REVENUECAT_WEBHOOK_AUTH`.

`POST /api/revenuecat/webhook` accepts RevenueCat's `{ "event": ... }` envelope. It authenticates before processing, stores unique event IDs, applies a transaction, and ignores stale updates by event timestamp. Product IDs and store environments are tracked separately. Events for an unknown app user ID are recorded without granting any account access.

Cancellation of renewal preserves paid access until expiry. `EXPIRATION` revokes the affected product. A cancellation marked `CUSTOMER_SUPPORT` is treated conservatively as a refund of that product; another active product still grants its own entitlement. Pause/billing notifications and unsupported events are recorded without inventing entitlement changes. RevenueCat documents the distinction between cancellation and expiration in its [event reference](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields).

Webhook retries return `{ "received": true, "duplicate": true }`; first delivery returns `{ "received": true, "duplicate": false, "outcome": "applied" }` or a recorded outcome such as `stale`, `test`, `unknown_user`, or `ignored_event_type`. Dashboard test events are supported. `TRANSFER` and subscriber alias events are currently recorded but do not migrate access; live subscriber reconciliation and purchase-identity transfer testing remain required before production purchase rollout.

## PostgreSQL and deployment

Set `DATABASE_URL` to activate the PostgreSQL adapter. Its pool and SQL transactions are implemented; the API applies the initial idempotent schema at startup. `server/sql/postgres.sql` is provided for explicit provisioning. Production should use a managed database with backups and a TLS connection string. Later schema changes should be versioned migrations rather than edits to already-applied definitions.

A multistage Dockerfile builds the API and runs it as the unprivileged Node user. From `server/`, `docker build -t fitness-api .` prepares a deployable image. No hosting service is created by these files. A production environment must provide PostgreSQL, HTTPS, allowed origins, and the new app's RevenueCat configuration.

The SQLite HTTP integration tests cover hashed credentials/sessions, normalized login, session revocation/expiry, cross-account isolation, JSON validation and bounds, synchronization conflicts, CORS, restart persistence, webhook authentication and validation, duplicate and out-of-order events, cancellation, expiry, refunds, store environments, authentication rate limits, export authorization/credential exclusion, and password-confirmed account deletion with cascading cleanup. PostgreSQL deployment and actual store purchases require external configuration and have not been validated against a live service in this local setup.

Before a public launch, complete email verification and recovery, distributed authentication rate limits, subscription reconciliation/transfers, third-party privacy-erasure integration, monitoring/backups, and real-device purchase/restore testing. The current API is a working local backend with production integration points, not a claim those external services are already deployed.
