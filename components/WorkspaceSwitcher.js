'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkspaceSwitcher({ workspace, workspaces }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  if (workspaces.length < 2) return null;
  async function change(e) {
    const id = e.target.value; setBusy(true);
    const r = await fetch('/api/workspaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    if (r.ok) router.refresh(); else { setBusy(false); window.alert('Could not switch workspaces.'); }
  }
  return <label className="workspace-switch"><span className="sr-only">Active workspace</span><select value={workspace.id} onChange={change} disabled={busy} aria-label="Switch workspace">{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>;
}
