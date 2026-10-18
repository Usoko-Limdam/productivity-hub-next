'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Projects from './Projects';
import Overview from './Overview';
import Money from './Money';
import Diary from './Diary';
import Bravestone from './Bravestone';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import { ClientsHub, MoreHub, WorkHub } from './NavigationHubs';
import { Empty, Icon, fmtD, pad, period, submit, uid, ymd } from './ui';

const H = { 'Content-Type': 'application/json' };

const TABS = {
  ov: ['Overview', 'Your day and your business at a glance.'],
  work: ['Work', 'Tasks, notes, calendar and goals.'],
  clients: ['Clients', 'Client engagements and sales.'],
  more: ['More', 'Settings and other modules.'],
  diary: ['Diary / Notes', 'Capture ideas, drafts, and checklists.'],
  cal: ['Calendar', 'Plan your day, one task at a time.'],
  goals: ['Goals', 'Set weekly, monthly, and annual targets and watch them fill up.'],
  proj: ['Engagements', 'Projects and ongoing services for your clients.'],
  money: ['Money', 'Sales, expenses and profit.'],
  set: ['Settings', 'Currency, backups and sign out.'],
  brave: ['Bravestone Learning', 'Education and professional development.'],
};

// Where you are lives in the URL hash (#money/sales), so the phone's back button steps back through screens.
const parseHash = () => {
  const [t, ...rest] = window.location.hash.slice(1).split('/');
  return Object.hasOwn(TABS, t) ? { tab: t, sub: rest.join('/') || null } : { tab: 'ov', sub: null };
};

async function send(op, workspaceId) {
  const r = op.del
    ? await fetch('/api/items?id=' + encodeURIComponent(op.id) + '&workspaceId=' + encodeURIComponent(workspaceId), { method: 'DELETE' })
    : await fetch('/api/items', { method: 'POST', headers: H, body: JSON.stringify({ kind: op.kind, id: op.id, data: op.data, workspaceId }) });
  if (r.status === 401) { const e = new Error('expired'); e.expired = true; throw e; }
  if (!r.ok) throw new Error('save failed');
}

export default function App({ initial, workspace, workspaces }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [route, setRoute] = useState({ tab: 'ov', sub: null });
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState({ pending: 0, failed: 0, expired: false, saved: false });
  // Saves go out one at a time, in order. Anything that fails is kept (latest change per record) until you retry.
  const chain = useRef(Promise.resolve());
  const failed = useRef(new Map());
  const pending = useRef(0);
  const expired = useRef(false);
  const timer = useRef(null);

  useEffect(() => {
    setRoute(parseHash()); setReady(true);
    const onPop = () => setRoute(parseHash());
    const onLeave = e => { if (pending.current || failed.current.size) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', onLeave);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('beforeunload', onLeave); };
  }, []);
  if (!ready) return null; // avoids server/browser date mismatches

  const report = saved => setSync({ pending: pending.current, failed: failed.current.size, expired: expired.current, saved });
  const run = op => {
    pending.current++; report(false);
    chain.current = chain.current.then(async () => {
      try { await send(op, workspace.id); failed.current.delete(op.id); }
      catch (e) { failed.current.set(op.id, op); if (e.expired) expired.current = true; }
      pending.current--;
      if (!pending.current && !failed.current.size) {
        expired.current = false; report(true);
        clearTimeout(timer.current); timer.current = setTimeout(() => report(false), 2000);
      } else report(false);
    });
  };
  const retry = () => {
    const ops = [...failed.current.values()];
    failed.current.clear(); expired.current = false;
    if (!ops.length) return report(false);
    ops.forEach(run);
  };

  const of = k => items.filter(x => x.kind === k).map(x => x.data);
  const put = (kind, o) => {
    setItems(a => a.some(x => x.id === o.id) ? a.map(x => x.id === o.id ? { ...x, data: o } : x) : [...a, { id: o.id, kind, data: o }]);
    run({ id: o.id, kind, data: o });
  };
  const del = id => { setItems(a => a.filter(x => x.id !== id)); run({ id, del: true }); };
  const go = (tab, sub = null) => {
    const hash = '#' + tab + (sub ? '/' + sub : '');
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    setRoute({ tab, sub }); window.scrollTo(0, 0);
  };

  const cur = of('setting').find(s => s.id === 'cur')?.v ?? '₦';
  const money = n => cur + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const p = { of, put, del, money, go, sub: route.sub };
  const { tab } = route;
  const isBravestone = workspace?.slug === 'bravestone-learning';
  const braveTitle = {
    overview: ['Overview', 'A view of enrolments, programmes, sessions and revenue.'],
    programmes: ['Programmes', 'Create programme offers and schedule cohorts.'],
    learners: ['Learners & Enrolments', 'Manage learner records, enrolments and payments.'],
    instructors: ['Instructors', 'Keep instructor contact and expertise details.'],
    calendar: ['Calendar', 'Schedule cohort sessions and review upcoming operations.'],
    marketing: ['Marketing & Sales', 'Track prospective learners and corporate leads.'],
    money: ['Money', 'Track sales, expenses, draws and profit.'],
    tasks: ['Tasks & Operations', 'Plan and complete operational tasks.'],
    reports: ['Reports', 'Review live programme, learner and financial totals.'],
    settings: ['Settings', 'Workspace details and business settings.'],
  };
  const currentTitle = isBravestone ? (braveTitle[route.sub?.split('/')[0]] || braveTitle.overview) : TABS[tab];

  const exportData = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ items })], { type: 'application/json' }));
    a.download = 'workhub-backup.json'; a.click();
  };
  const importData = e => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result), o = [];
        if (Array.isArray(j.items)) j.items.forEach(x => o.push([x.kind, x.data]));
        else { // backup from the earliest browser-only version
          Object.entries(j.tasks || {}).forEach(([date, a]) => a.forEach(t => o.push(['task', { ...t, date }])));
          (j.goals || []).forEach(x => o.push(['goal', x])); (j.projects || []).forEach(x => o.push(['project', x]));
          (j.sales || []).forEach(x => o.push(['sale', x])); (j.exp || []).forEach(x => o.push(['expense', x]));
        }
        o.forEach(([k, x]) => put(k, x));
      } catch { alert('Invalid backup file'); }
    };
    r.readAsText(e.target.files[0]); e.target.value = '';
  };
  const logout = async () => { await fetch('/api/login', { method: 'DELETE' }); router.refresh(); };

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><span className="logo">W</span>WorkHub</div>
        <nav className="desktop-nav" aria-label="Main navigation">
          {isBravestone ? <><button className={tab === 'brave' ? 'on' : ''} onClick={() => go('brave', 'overview')}><Icon n="ov"/><span>Overview</span></button></> : Object.entries(TABS).filter(([k]) => !['work', 'clients', 'more', 'brave'].includes(k)).map(([k, [label]]) => (
            <button key={k} className={k === tab ? 'on' : ''} aria-current={k === tab ? 'page' : undefined} onClick={() => go(k)}><Icon n={k} /><span>{label}</span></button>
          ))}
        </nav>
        {!isBravestone && <nav className="mobile-nav" aria-label="Main navigation">
          {[
            { key: 'ov', label: 'Home', active: tab === 'ov' },
            { key: 'work', label: 'Work', active: ['work', 'diary', 'cal', 'goals'].includes(tab) },
            { key: 'clients', label: 'Clients', active: ['clients', 'proj'].includes(tab) },
            { key: 'money', label: 'Money', active: tab === 'money' },
            { key: 'more', label: 'More', active: ['more', 'set'].includes(tab) },
          ].map(({ key, label, active }) => (
            <button key={key} className={active ? 'on' : ''} aria-current={active ? 'page' : undefined} onClick={() => go(key)}>
              <Icon n={key} /><span>{label}</span>
            </button>
          ))}
        </nav>}
      </aside>
      <section className="content">
        {sync.failed > 0 && (
          <div className="banner" role="alert">
            <span>{sync.expired
              ? 'Your session expired, so recent changes are not saved yet. Sign in again in a new tab, then press Retry.'
              : `${sync.failed} change${sync.failed === 1 ? '' : 's'} could not be saved. Check your connection, then press Retry.`}</span>
            {sync.expired && <button className="btn sm" onClick={() => window.open('/', '_blank')}>Open sign-in</button>}
            <button className="btn sm pri" onClick={retry}>Retry</button>
          </div>
        )}
        <header className="ph">
          <div><h1>{currentTitle[0]}</h1><p>{currentTitle[1]}</p></div>
          <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} />
          <span className={'sync' + (sync.saved && !sync.pending ? ' ok' : '')} role="status" aria-live="polite">
            {sync.pending > 0 ? 'Saving…' : sync.saved ? '✓ Saved' : ''}
          </span>
        </header>
        <div className="fade" key={tab + ':' + route.sub}>
          {isBravestone && tab === 'brave' && <Bravestone {...p} sub={route.sub} />}
          {tab === 'ov' && <Overview {...p} />}
          {tab === 'work' && <WorkHub go={go} />}
          {tab === 'clients' && <ClientsHub go={go} />}
          {tab === 'more' && <MoreHub go={go} />}
          {tab === 'diary' && <Diary {...p} />}
          {tab === 'cal' && <Calendar {...p} />}
          {tab === 'goals' && <Goals {...p} />}
          {tab === 'proj' && <Projects {...p} />}
          {tab === 'money' && <Money {...p} />}
          {tab === 'set' && (
            <div className="card">
              <div className="setrow"><div><b>Currency</b><span className="mut">Used for sales, expenses and project values.</span></div>
                <select value={cur} onChange={e => put('setting', { id: 'cur', v: e.target.value })}><option>₦</option><option>$</option><option>£</option></select></div>
              <div className="setrow"><div><b>Backup</b><span className="mut">Download your data, or restore from a backup file.</span></div>
                <span style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={exportData}>Export</button>
                  <label className="btn">Import<input type="file" accept=".json" hidden onChange={importData} /></label></span></div>
              <div className="setrow"><div><b>Sign out</b><span className="mut">You will need your password to get back in.</span></div>
                <button className="btn" onClick={logout}>Log out</button></div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Calendar({ of, put, del }) {
  const today = ymd(new Date());
  const [[y, m], setV] = useState(() => { const n = new Date(); return [n.getFullYear(), n.getMonth()]; });
  const [sel, setSel] = useState(today);
  const tasks = of('task');
  const allNotes = of('note');
  const notes = allNotes.filter(note => note.date === sel);
  const off = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
  const move = d => { const x = new Date(y, m + d, 1); setV([x.getFullYear(), x.getMonth()]); };
  const day = tasks.filter(t => t.date === sel), done = day.filter(t => t.d).length;
  return (
    <div className="grid2">
      <div className="card">
        <div className="top"><button className="btn sm" onClick={() => move(-1)} aria-label="Previous month">‹</button><b>{fmtD(new Date(y, m, 1), { month: 'long', year: 'numeric' })}</b><button className="btn sm" onClick={() => move(1)} aria-label="Next month">›</button></div>
        <div className="cal">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="h">{d}</div>)}
          {Array.from({ length: off }, (_, i) => <span key={'o' + i} />)}
          {Array.from({ length: n }, (_, i) => {
            const k = `${y}-${pad(m + 1)}-${pad(i + 1)}`, t = tasks.filter(x => x.date === k), hasNote = allNotes.some(note => note.date === k);
            return <button key={k} className={`${k === today ? 'td ' : ''}${k === sel ? 'sel' : ''}`} onClick={() => setSel(k)}>{i + 1}<small>{t.length ? `${t.filter(x => x.d).length}/${t.length}` : hasNote ? 'Note' : '·'}</small></button>;
          })}
        </div>
      </div>
      <div className="card">
        <h2>{fmtD(new Date(sel + 'T00:00'), { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        {day.length > 0 && <div style={{ marginBottom: 6 }}><span className="mut">{done} of {day.length} done</span><div className="bar"><b style={{ width: (done / day.length * 100) + '%' }} /></div></div>}
        {day.map(t => (
          <div className="row" key={t.id}>
            <input type="checkbox" checked={t.d} onChange={() => put('task', { ...t, d: !t.d })} />
            <span className={'g ' + (t.d ? 'done' : '')}>{t.t}</span>
            <button className="x" onClick={() => del(t.id)} aria-label="Delete task">×</button>
          </div>
        ))}
        {!day.length && <Empty>Nothing planned for this day.</Empty>}
        <form onSubmit={submit(d => put('task', { id: uid(), date: sel, t: d.t, d: false }))}>
          <input name="t" placeholder="Add a task…" required /><button className="btn pri">Add</button>
        </form>
        <h2 style={{ marginTop: 24 }}>Daily notes</h2>
        <p className="mut">Context, review, or preview for this day. Notes are separate from tasks.</p>
        {notes.map(note => <Note key={note.id} note={note} put={put} del={del} />)}
        {!notes.length && <Empty>No notes for this day.</Empty>}
        <form onSubmit={submit(d => put('note', { id: uid(), date: sel, text: d.text.trim() }))}>
          <textarea name="text" placeholder="Add a note for this day…" required rows="3" style={{ flex: '1 1 100%', resize: 'vertical' }} />
          <button className="btn pri">Add note</button>
        </form>
      </div>
    </div>
  );
}

function Note({ note, put, del }) {
  const [editing, setEditing] = useState(false);
  return <div className="row" style={{ alignItems: 'flex-start' }}>
    {editing
      ? <textarea autoFocus defaultValue={note.text} rows="3" style={{ flex: 1, resize: 'vertical' }} aria-label="Edit note"
          onBlur={e => { const text = e.target.value.trim(); if (text && text !== note.text) put('note', { ...note, text }); setEditing(false); }} />
      : <span className="g" style={{ whiteSpace: 'pre-wrap' }}>{note.text}</span>}
    <button className="x txt" onClick={() => setEditing(true)} aria-label="Edit note">Edit</button>
    <button className="x" onClick={() => del(note.id)} aria-label="Delete note">×</button>
  </div>;
}

function Goals({ of, put, del }) {
  const [type, setType] = useState('weekly'), [off, setOff] = useState(0);
  const p = period(type, off), list = of('goal').filter(g => g.type === type && g.p === p.key);
  const step = (g, d) => put('goal', { ...g, cur: Math.max(0, g.cur + d) });
  return (
    <div className="card">
      <div className="top">
        <div style={{ display: 'flex', gap: 6 }}>{['weekly', 'monthly', 'annual'].map(t => <button key={t} className={'btn sm ' + (t === type ? 'pri' : '')} onClick={() => { setType(t); setOff(0); }}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><button className="btn sm" onClick={() => setOff(off - 1)} aria-label="Previous period">‹</button><b>{p.label}</b><button className="btn sm" onClick={() => setOff(off + 1)} aria-label="Next period">›</button></div>
      </div>
      {list.map(g => {
        const pc = Math.min(100, g.cur / g.tar * 100);
        return (
          <div className="row" key={g.id}>
            <div className="g"><span><b className={pc >= 100 ? 'pos' : ''}>{g.title}</b> <span className="mut">{g.cur}/{g.tar} {g.unit}</span></span><div className="bar"><b style={{ width: pc + '%' }} /></div></div>
            <button className="btn sm" onClick={() => step(g, -1)} aria-label="Decrease">−</button><button className="btn sm" onClick={() => step(g, 1)} aria-label="Increase">+</button>
            <button className="x" onClick={() => del(g.id)} aria-label="Delete goal">×</button>
          </div>
        );
      })}
      {!list.length && <Empty>No goals for this period yet.</Empty>}
      <form onSubmit={submit(d => put('goal', { id: uid(), type, p: p.key, title: d.title, tar: Math.max(1, +d.tar || 1), cur: 0, unit: d.unit || '' }))}>
        <input name="title" placeholder="Goal (e.g. Close 3 deals)" required /><input name="tar" type="number" min="1" defaultValue="1" title="Target" />
        <input name="unit" placeholder="Unit (optional)" style={{ width: 130 }} /><button className="btn pri">Add goal</button>
      </form>
    </div>
  );
}
