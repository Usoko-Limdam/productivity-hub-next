// Failed-login tracking, kept apart from the route so it can be tested against a real Postgres engine.
// Every function takes the tagged-template `sql` as its first argument.
export const MAX_FAILS = 5;
export const WINDOW_SECS = 15 * 60;

export async function ensure(sql) {
  await sql`CREATE TABLE IF NOT EXISTS login_attempts (ip text NOT NULL, at timestamptz NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS login_attempts_ip_at ON login_attempts (ip, at)`;
}

// Locked once an address has MAX_FAILS failures inside the window; unlocks when the oldest one ages out.
export async function status(sql, ip) {
  const [r] = await sql`
    SELECT count(*)::int AS n, COALESCE(EXTRACT(EPOCH FROM (now() - min(at))), 0)::int AS age
    FROM login_attempts WHERE ip = ${ip} AND at > now() - interval '15 minutes'`;
  return r.n >= MAX_FAILS ? { locked: true, retryAfter: Math.max(WINDOW_SECS - r.age, 1) } : { locked: false };
}

export async function recordFail(sql, ip) {
  await sql`INSERT INTO login_attempts (ip) VALUES (${ip})`;
  await sql`DELETE FROM login_attempts WHERE at < now() - interval '1 day'`;
}

export const clear = (sql, ip) => sql`DELETE FROM login_attempts WHERE ip = ${ip}`;
