import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';
import { sign } from '../../../lib/auth';

export async function POST(req) {
  const { password = '' } = await req.json().catch(() => ({}));
  const a = Buffer.from(String(password));
  const b = Buffer.from(process.env.APP_PASSWORD || '');
  const ok = b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
  if (!ok) {
    await new Promise(r => setTimeout(r, 800)); // slow down guessing
    return NextResponse.json({ error: 'wrong password' }, { status: 401 });
  }
  (await cookies()).set('session', await sign(), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/',
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  (await cookies()).delete('session');
  return NextResponse.json({ ok: true });
}
