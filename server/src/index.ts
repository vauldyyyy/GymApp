import 'dotenv/config';
import { resolve } from 'node:path';
import { createApp } from './app.js';
import { postgresDatabase, sqliteDatabase } from './database.js';

const production = process.env.NODE_ENV === 'production';
if (production && !process.env.DATABASE_URL) throw new Error('Production requires DATABASE_URL. SQLite is for local development.');
const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
const sessionDays = Number(process.env.SESSION_DAYS ?? 30);
if (!Number.isFinite(sessionDays) || sessionDays <= 0 || sessionDays > 365) throw new Error('SESSION_DAYS must be between 0 and 365.');
const environment = process.env.REVENUECAT_ENVIRONMENT ?? (production ? 'PRODUCTION' : 'SANDBOX');
if (environment !== 'PRODUCTION' && environment !== 'SANDBOX') throw new Error('REVENUECAT_ENVIRONMENT must be PRODUCTION or SANDBOX.');
const database = process.env.DATABASE_URL
  ? await postgresDatabase(process.env.DATABASE_URL)
  : sqliteDatabase(resolve(process.env.SQLITE_PATH ?? './data/forma.sqlite'));
const app = await createApp({
  database,
  webhookSecret: process.env.REVENUECAT_WEBHOOK_AUTH,
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map((origin) => origin.trim()).filter(Boolean),
  allowLocalhost: !production,
  allowLocalPreview: !production,
  sessionDurationMs: sessionDays * 24 * 60 * 60 * 1000,
  proEntitlement: process.env.REVENUECAT_PRO_ENTITLEMENT ?? 'forma_pro',
  revenueCatEnvironment: environment,
});
const host = process.env.HOST ?? (production ? '0.0.0.0' : '127.0.0.1');
const server = app.listen(port, host, () => {
  console.log(`Fitness API running at http://${host}:${port} (${database.kind})`);
  if (!process.env.REVENUECAT_WEBHOOK_AUTH) console.log('RevenueCat webhook disabled until REVENUECAT_WEBHOOK_AUTH is configured.');
});
server.on('error', async (error) => { console.error('Unable to start API:', error.message); await database.close(); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close(async () => { await database.close(); process.exitCode = 0; });
    setTimeout(() => { process.exit(1); }, 10_000).unref();
  });
}
