'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (busy) return;
    const password = new FormData(e.currentTarget).get('password');
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      if (r.ok) {
        router.refresh(); // the server now sees the session and swaps this screen for the app
        setTimeout(() => setBusy(false), 4000);
        return;
      }
      const j = await r.json().catch(() => ({}));
      setErr(r.status === 429 ? `Too many wrong attempts. Try again in ${Math.ceil((j.retryAfter || 900) / 60)} minutes.`
        : r.status === 401 ? 'That password is not right. Try again.'
        : 'Something went wrong on our side. Try again in a moment.');
    } catch {
      setErr('Cannot reach the server. Check your connection and try again.');
    }
    setBusy(false);
  };

  return (
    <main className="auth">
      <div className="auth-card fade">
        <span className="logo big">W</span>
        <h1>Welcome back</h1>
        <p className="mut">Sign in to WorkHub</p>
        <form onSubmit={submit}>
          {/* Password managers only offer to save a login that has a username field. */}
          <input className="sr-only" type="text" name="username" autoComplete="username" defaultValue="WorkHub" tabIndex={-1} aria-hidden="true" readOnly />
          <div className="pw">
            <input type={show ? 'text' : 'password'} name="password" placeholder="Password" autoComplete="current-password" required autoFocus
              aria-label="Password" aria-invalid={!!err} aria-describedby="login-err" />
            <button type="button" className="eye" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
          </div>
          <button className="btn pri wide" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p id="login-err" className="err" role="alert">{err}</p>
        </form>
      </div>
    </main>
  );
}
