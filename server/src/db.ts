import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { POSTGRES_DB, POSTGRES_SERVER, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER } = process.env;
  if (!POSTGRES_DB || !POSTGRES_SERVER || !POSTGRES_USER) {
    throw new Error('No database config: set DATABASE_URL or the RunOS POSTGRES_* env vars');
  }
  const passwordPart = POSTGRES_PASSWORD ? `:${encodeURIComponent(POSTGRES_PASSWORD)}` : '';
  return `postgres://${POSTGRES_USER}${passwordPart}@${POSTGRES_SERVER}:${POSTGRES_PORT || 5432}/${POSTGRES_DB}`;
}

export const pool = new Pool({
  connectionString: resolveDatabaseUrl(),
  max: 10,
});

let schemaReady: Promise<void> | null = null;

export function initSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      // schema.sql lives at repo root db/ in dev; in the container we copy it next to dist.
      const candidates = [
        path.resolve(__dirname, '../../db/schema.sql'),
        path.resolve(__dirname, '../db/schema.sql'),
        path.resolve(process.cwd(), 'db/schema.sql'),
        path.resolve(process.cwd(), 'schema.sql'),
        path.resolve(__dirname, 'schema.sql'),
      ];
      let sql: string | null = null;
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          sql = fs.readFileSync(p, 'utf8');
          break;
        }
      }
      if (!sql) throw new Error('schema.sql not found in any known location');
      await pool.query(sql);
    })();
  }
  return schemaReady;
}

export async function ensureAdminFromEnv(): Promise<void> {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return;
  const q = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (q.rows[0].n > 0) return;
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (username, password_hash, display_name, role)
     VALUES ($1, $2, $3, 'admin') ON CONFLICT (username) DO NOTHING`,
    [username, hash, 'HEROES Admin']
  );
  console.log(`[boot] admin account created: ${username}`);
}

export async function q<T = any>(text: string, params?: any[]): Promise<T[]> {
  const res = await pool.query(text, params);
  return res.rows as T[];
}
