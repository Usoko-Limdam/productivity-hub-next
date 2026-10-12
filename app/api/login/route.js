import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createHash, timingSafeEqual } from 'node:crypto';
import { sign } from '../../../lib/auth';
import { sql, initAttempts } from '../../../lib/db';
import { status, recordFail, clear } from '../../../lib/lockout';

// Hashing first means the comparison always sees equal-length inputs.
const digest = s => createHash('sha256').update(String(s)).digest();

export async function POST(req) {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown';

  try {
    await initAttempts();
    const s = await status(sql, ip);
    if (s.locked) {
      return NextResponse.json({ error: 'locked', retryAfter: s.retryAfter }, { status: 429, headers: { 'Retry-After': String(s.retryAfter) } });
    }
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  const { password = '' } = await req.json().catch(() => ({}));
  const ok = !!process.env.APP_PASSWORD && timingSafeEqual(digest(password), digest(process.env.APP_PASSWORD));
  if (!ok) {
    try { await recordFail(sql, ip); } catch {}
    await new Promise(r => setTimeout(r, 800)); // slow down guessing
    return NextResponse.json({ error: 'wrong password' }, { status: 401 });
  }

  try { await clear(sql, ip); } catch {}
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
