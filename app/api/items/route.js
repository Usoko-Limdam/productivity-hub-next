import { NextResponse } from 'next/server';
import { authed } from '../../../lib/auth';
import { sql, init } from '../../../lib/db';

const KINDS = ['task', 'goal', 'project', 'sale', 'expense', 'setting'];
const no = () => NextResponse.json({ error: 'unauthorized' }, { status: 401 });

export async function POST(req) {
  if (!(await authed())) return no();
  const { kind, id, data } = await req.json().catch(() => ({}));
  if (!KINDS.includes(kind) || typeof id !== 'string' || !id || id.length > 64 || typeof data !== 'object')
    return NextResponse.json({ error: 'bad request' }, { status: 400 });
  await init();
  await sql`INSERT INTO items (id, kind, data) VALUES (${id}, ${kind}, ${JSON.stringify(data)}::jsonb)
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
