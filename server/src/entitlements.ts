import type { Database, Queryable, Row } from './database.js';
import { ApiError, record, text } from './http.js';

interface EntitlementRow extends Row {
  entitlement_id: string;
  product_id: string;
  active: number;
  expires_at: number | string | null;
  period_type: string | null;
  last_event_at: number | string;
}

export async function readEntitlements(database: Queryable, userId: string, proId: string, environment: string, now = Date.now()) {
  const { rows } = await database.query<EntitlementRow>(
    'SELECT * FROM entitlements WHERE user_id = $1 AND environment = $2 AND active = 1 AND (expires_at IS NULL OR expires_at > $3)',
    [userId, environment, now],
  );
  const entitlements = rows.map((row) => ({
    id: row.entitlement_id,
    productId: row.product_id,
    expiresAt: row.expires_at === null ? null : new Date(Number(row.expires_at)).toISOString(),
    periodType: row.period_type,
  }));
  return { entitlements, isPro: entitlements.some((entitlement) => entitlement.id === proId) };
}

export interface RevenueCatEvent {
  id: string;
  type: string;
  appUserId: string | null;
  productId: string | null;
  entitlementIds: string[];
  eventAt: number;
  expiresAt: number | null;
  periodType: string | null;
  cancelReason: string | null;
  environment: string;
}

export function parseRevenueCatEvent(body: unknown): RevenueCatEvent {
  const event = record(record(body).event, 'RevenueCat event');
  const type = text(event.type, 'Event type', 1, 80);
  const eventAt = event.event_timestamp_ms;
  if (!Number.isSafeInteger(eventAt) || Number(eventAt) < 0 || Number(eventAt) > 8.64e15) {
    throw new ApiError(400, 'invalid_event', 'Event timestamp must be UTC milliseconds.');
  }
  const expiration = event.expiration_at_ms;
  if (expiration !== undefined && expiration !== null && (!Number.isSafeInteger(expiration) || Number(expiration) < 0 || Number(expiration) > 8.64e15)) {
    throw new ApiError(400, 'invalid_event', 'Event expiration must be UTC milliseconds or null.');
  }
  const ids = event.entitlement_ids ?? [];
  if (!Array.isArray(ids) || ids.length > 30 || ids.some((id) => typeof id !== 'string' || !id.length || id.length > 200)) {
    throw new ApiError(400, 'invalid_event', 'Entitlement IDs must be an array of strings.');
  }
  const environment = type === 'TEST' ? 'SANDBOX' : text(event.environment, 'Environment', 7, 10);
  if (!['PRODUCTION', 'SANDBOX'].includes(environment)) throw new ApiError(400, 'invalid_event', 'Invalid RevenueCat environment.');
  return {
    id: text(event.id, 'Event ID', 1, 200),
    type,
    appUserId: event.app_user_id === undefined && ['TEST', 'TRANSFER'].includes(type) ? null : text(event.app_user_id, 'App user ID', 1, 200),
    productId: event.product_id === undefined ? null : text(event.product_id, 'Product ID', 1, 200),
    entitlementIds: [...new Set(ids as string[])],
    eventAt: Number(eventAt),
    expiresAt: expiration === undefined || expiration === null ? null : Number(expiration),
    periodType: typeof event.period_type === 'string' ? event.period_type.slice(0, 30) : null,
    cancelReason: typeof event.cancel_reason === 'string' ? event.cancel_reason : null,
    environment,
  };
}

const changesAccess = new Set([
  'INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED', 'CANCELLATION', 'EXPIRATION',
]);

export async function applyRevenueCatEvent(database: Database, event: RevenueCatEvent, now = Date.now()) {
  return database.transaction(async (transaction) => {
    const inserted = await transaction.query(
      `INSERT INTO webhook_events (id, event_type, app_user_id, event_at, received_at, outcome)
       VALUES ($1, $2, $3, $4, $5, 'received') ON CONFLICT (id) DO NOTHING RETURNING id`,
      [event.id, event.type, event.appUserId, event.eventAt, now],
    );
    if (!inserted.rowCount) return { received: true, duplicate: true };
    const finish = async (outcome: string) => {
      await transaction.query('UPDATE webhook_events SET outcome = $1 WHERE id = $2', [outcome, event.id]);
      return { received: true, duplicate: false, outcome };
    };
    if (event.type === 'TEST') {
      await transaction.query('UPDATE webhook_events SET app_user_id = NULL WHERE id = $1', [event.id]);
      return finish('test');
    }
    const user = event.appUserId ? await transaction.query('SELECT id FROM users WHERE id = $1', [event.appUserId]) : null;
    if (event.appUserId && !user?.rowCount) {
      // A late billing event must not recreate a deleted account's identifier.
      // Retain the event ID solely for deduplication, without its app user ID.
      await transaction.query('UPDATE webhook_events SET app_user_id = NULL WHERE id = $1', [event.id]);
      return finish('unknown_user');
    }
    if (!changesAccess.has(event.type)) return finish('ignored_event_type');
    if (!event.appUserId || !event.productId) throw new ApiError(400, 'invalid_event', 'Subscription events require app_user_id and product_id.');
    if (database.kind === 'postgresql') await transaction.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [event.appUserId]);

    const { rows: previous } = await transaction.query<EntitlementRow>(
      'SELECT * FROM entitlements WHERE user_id = $1 AND product_id = $2 AND environment = $3',
      [event.appUserId, event.productId, event.environment],
    );
    // Events such as expiration sometimes omit entitlement_ids. Existing rows
    // still let us revoke exactly the affected product, leaving other products.
    const ids = [...new Set([...event.entitlementIds, ...previous.map((row) => row.entitlement_id)])];
    if (!ids.length) return finish('no_entitlements');
    let changed = 0;
    for (const id of ids) {
      const old = previous.find((row) => row.entitlement_id === id);
      if (old && Number(old.last_event_at) > event.eventAt) continue;
      // Do not let an equal-timestamp, retried lifecycle notification resurrect
      // a product after an explicit expiry/refund has already revoked it.
      const isRefund = event.type === 'CANCELLATION' && event.cancelReason === 'CUSTOMER_SUPPORT';
      const revoked = event.type === 'EXPIRATION' || isRefund;
      if (old && Number(old.last_event_at) === event.eventAt && Number(old.active) === 0 && !revoked) continue;
      const expiresAt = event.expiresAt ?? (old?.expires_at === null ? null : old ? Number(old.expires_at) : null);
      const lifetime = event.type === 'NON_RENEWING_PURCHASE' && event.expiresAt === null;
      const remainsLifetime = old?.expires_at === null && Number(old.active) === 1;
      // Cancellation of auto-renewal keeps the paid period. Billing-issue and
      // pause notifications do not grant/revoke access and are logged above.
      const active = !revoked && (expiresAt !== null ? expiresAt > now : lifetime || remainsLifetime) ? 1 : 0;
      const result = await transaction.query(
        `INSERT INTO entitlements (user_id, entitlement_id, product_id, active, expires_at, period_type, environment, last_event_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, entitlement_id, product_id, environment) DO UPDATE SET
           active = excluded.active, expires_at = excluded.expires_at, period_type = excluded.period_type,
           last_event_at = excluded.last_event_at, updated_at = excluded.updated_at
         WHERE entitlements.last_event_at <= excluded.last_event_at`,
        [event.appUserId, id, event.productId, active, expiresAt, event.periodType ?? old?.period_type ?? null, event.environment, event.eventAt, now],
      );
      changed += result.rowCount;
    }
    return finish(changed ? 'applied' : 'stale');
  });
}
