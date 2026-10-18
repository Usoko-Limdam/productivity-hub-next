import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authed } from '../../../lib/auth';
import { init } from '../../../lib/db';
import { ownerWorkspace, WORKSPACE_COOKIE } from '../../../lib/workspaces';

export async function POST(req) {
  if (!(await authed())) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await req.json().catch(() => ({}));
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'Choose a workspace.' }, { status: 400 });
  await init();
  const workspace = await ownerWorkspace(id);
  if (!workspace) return NextResponse.json({ error: 'Workspace unavailable.' }, { status: 404 });
  (await cookies()).set(WORKSPACE_COOKIE, workspace.id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return NextResponse.json({ ok: true });
}
