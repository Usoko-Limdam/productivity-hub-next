'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [err, setErr] = useState('');
  const submit = async e => {
    e.preventDefault();
    const r = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: new FormData(e.target).get('password') }),
    });
    if (r.ok) router.refresh(); else setErr('Wrong password');
  };
  return (
    <div className="card" style={{ maxWidth: 340, margin: '60px auto' }}>
      <h2>Productivity Hub</h2>
      <form onSubmit={submit}>
        <input type="password" name="password" placeholder="Password" required autoFocus />
        <button className="btn pri">Enter</button>
      </form>
      <p className="mut">{err}</p>
    </div>
  );
}
