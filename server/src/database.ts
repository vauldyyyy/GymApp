import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Pool, type PoolClient } from 'pg';
import { schema } from './schema.js';

export type Row = Record<string, unknown>;
export interface QueryResult<T extends Row = Row> { rows: T[]; rowCount: number }
export interface Queryable {
  query<T extends Row = Row>(sql: string, values?: unknown[]): Promise<QueryResult<T>>;
}
export interface Database extends Queryable {
  kind: 'sqlite' | 'postgresql';
  transaction<T>(operation: (transaction: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

class Mutex {
  private tail = Promise.resolve();
  async run<T>(operation: () => T | Promise<T>): Promise<T> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    try { return await operation(); } finally { release(); }
  }
}

export function sqliteDatabase(filename = ':memory:'): Database {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const connection = new DatabaseSync(filename);
  connection.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (filename !== ':memory:') connection.exec('PRAGMA journal_mode = WAL;');
  connection.exec(schema);
  const mutex = new Mutex();

  const raw: Queryable = {
    async query<T extends Row = Row>(sql: string, values: unknown[] = []): Promise<QueryResult<T>> {
      const ordered: (string | number | null | Uint8Array)[] = [];
      const compatibleSql = sql.replace(/\$(\d+)/g, (_, index: string) => {
        ordered.push(values[Number(index) - 1] as string | number | null);
        return '?';
      });
      const statement = connection.prepare(compatibleSql);
      if (/^\s*(SELECT|WITH)\b/i.test(sql) || /\bRETURNING\b/i.test(sql)) {
        const rows = statement.all(...ordered) as T[];
        return { rows, rowCount: rows.length };
      }
      const result = statement.run(...ordered);
      return { rows: [], rowCount: Number(result.changes) };
    },
  };
  return {
    kind: 'sqlite',
    query: (sql, values) => mutex.run(() => raw.query(sql, values)),
    transaction: (operation) => mutex.run(async () => {
      connection.exec('BEGIN IMMEDIATE');
      try {
        const result = await operation(raw);
        connection.exec('COMMIT');
        return result;
      } catch (error) {
        connection.exec('ROLLBACK');
        throw error;
      }
    }),
    close: () => mutex.run(() => { connection.close(); }),
  };
}

export async function postgresDatabase(connectionString: string): Promise<Database> {
  const pool = new Pool({ connectionString, max: 10 });
  try { await pool.query(schema); } catch (error) { await pool.end(); throw error; }
  function queryable(client: Pool | PoolClient): Queryable {
    return {
      async query<T extends Row = Row>(sql: string, values: unknown[] = []) {
        const result = await client.query<T>(sql, values);
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
      },
    };
  }
  return {
    kind: 'postgresql',
    ...queryable(pool),
    async transaction(operation) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await operation(queryable(client));
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    },
    close: () => pool.end(),
  };
}
