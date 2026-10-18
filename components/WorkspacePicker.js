'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkspacePicker({ workspaces }) {
  const router = useRouter();
  const [busy, setBusy] = useState(''), [error, setError] = useState('');
  const choose = async id => {
    setBusy(id); setError('');
    try {
      const r = await fetch('/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!r.ok) throw new Error((await r.json()).error || 'Could not open workspace.');
      router.refresh();
    } catch (e) { setError(e.message); setBusy(''); }
  };
  return <main className="workspace-choice"><header><span className="logo">W</span><b>WorkHub</b></header><h1>Choose your workspace</h1><p className="mut">Open the business you want to work in. Each workspace keeps its records separate.</p><div className="workspace-cards">{workspaces.map(w => <button key={w.id} className="workspace-card" onClick={() => choose(w.id)} disabled={!!busy}><span className="workspace-mark">{w.brand}</span><span><b>{w.name}</b><small>{w.description}</small><em>{w.businessType}</em></span><strong>{busy === w.id ? 'Opening…' : 'Open →'}</strong></button>)}</div>{error && <p role="alert" className="error">{error}</p>}</main>;
}
