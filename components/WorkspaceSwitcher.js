'use client';
import { useState } from 'react';

export default function WorkspaceSwitcher({ workspace, workspaces, onBeforeSwitch }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (workspaces.length < 2) return null;
  async function change(e) {
    const id = e.target.value;
    if (id === workspace.id) return;
    setBusy(true); setError('');
    try {
      if (onBeforeSwitch && !(await onBeforeSwitch())) {
        setError('Save or retry pending changes before switching.'); setBusy(false); return;
      }
      const r = await fetch('/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || 'Could not switch workspaces.');
      }
      const next = workspaces.find(w => w.id === id);
      const destination = next?.slug === 'bravestone-learning' ? '/#brave/overview' : '/#ov';
      // A full document load resets the client cache and asks the server for data
      // using the newly set, HttpOnly workspace cookie.
      window.location.assign(destination);
    } catch (e) {
      setError(e.message || 'Could not switch workspaces.'); setBusy(false);
    }
  }
  return <div className="workspace-switch"><label><span className="sr-only">Active workspace</span><select value={workspace.id} onChange={change} disabled={busy} aria-label="Switch workspace">{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>{error && <small role="alert">{error}</small>}</div>;
}
