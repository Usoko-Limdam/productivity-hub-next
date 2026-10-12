import { NextResponse } from 'next/server';
import { authed } from '../../../lib/auth';
import { sql, init } from '../../../lib/db';

const KINDS = ['task', 'goal', 'project', 'sale', 'expense', 'setting'];
const no = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });
const bad = (error, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req) {
  if (!(await authed())) return no();
  const { kind, id, data } = await req.json().catch(() => ({}));
  if (!KINDS.includes(kind) || typeof id !== 'string' || !id || id.length > 64) return bad('bad request');
  // The data must be a plain object (never null or a list), and stay a sensible size.
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return bad('bad request');
  const json = JSON.stringify(data);
  if (json.length > 100_000) return bad('too large', 413);
  await init();
  await sql`INSERT INTO items (id, kind, data) VALUES (${id}, ${kind}, ${json}::jsonb)
            ON CONFLICT (id) DO UPDATE SET kind = EXCLUDED.kind, data = EXCLUDED.data`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!(await authed())) return no();
  const id = new URL(req.url).searchParams.get('id') || '';
  await init();
  await sql`DELETE FROM items WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
