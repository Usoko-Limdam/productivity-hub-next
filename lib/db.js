import { neon } from '@neondatabase/serverless';

// Created lazily so the build works without env vars.
export const sql = (...args) => neon(process.env.DATABASE_URL)(...args);

let ready;
export const init = () =>
  (ready ??= sql`CREATE TABLE IF NOT EXISTS items (
    id text PRIMARY KEY, kind text NOT NULL, data jsonb NOT NULL, created_at timestamptz DEFAULT now())`);
