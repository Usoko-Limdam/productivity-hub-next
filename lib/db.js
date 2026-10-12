import { neon } from '@neondatabase/serverless';
import { ensure } from './lockout';

// Created lazily so the build works without env vars.
export const sql = (...args) => neon(process.env.DATABASE_URL)(...args);

// Run a setup step once per server instance. A failed attempt is not remembered, so the next request tries again.
const once = fn => {
  let p;
  return () => (p ??= fn().catch(e => { p = undefined; throw e; }));
};

export const init = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS items (
    id text PRIMARY KEY, kind text NOT NULL, data jsonb NOT NULL, created_at timestamptz DEFAULT now())`;
});
export const initAttempts = once(() => ensure(sql));
