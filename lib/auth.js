import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

const key = () => new TextEncoder().encode(process.env.SESSION_SECRET);

export const sign = () =>
  new SignJWT({ ok: 1 }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('30d').sign(key());

export async function authed() {
  const t = (await cookies()).get('session')?.value;
  if (!t) return false;
  try { await jwtVerify(t, key()); return true; } catch { return false; }
}
