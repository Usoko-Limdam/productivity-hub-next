'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Projects from './Projects';
import Overview from './Overview';
import Money from './Money';
import Diary from './Diary';
import Bravestone from './Bravestone';
import Calendar from './Calendar';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import { ClientsHub, MoreHub, WorkHub } from './NavigationHubs';
import { Empty, Icon, period, submit, uid } from './ui';

const H = { 'Content-Type': 'application/json' };

const TABS = {
  ov: ['Overview', 'Your day and your business at a glance.'],
  work: ['Work', 'Tasks, notes, calendar and goals.'],
  clients: ['Clients', 'Client engagements and sales.'],
  more: ['More', 'Settings and other modules.'],
  diary: ['Diary / Notes', 'Capture ideas, drafts, and checklists'],
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

const routeForWorkspace = workspace => {
  const route = parseHash();
  const isBravestone = workspace?.slug === 'bravestone-learning';
  if (isBravestone && route.tab !== 'brave') {
    window.history.replaceState(null, '', '#brave/overview');
    return { tab: 'brave', sub: 'overview' };
  }
  if (!isBravestone && route.tab === 'brave') {
    window.history.replaceState(null, '', '#ov');
    return { tab: 'ov', sub: null };
  }
  return route;
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
  const loadedWorkspace = useRef(workspace?.id);
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
    if (loadedWorkspace.current !== workspace?.id) {
      setItems(initial);
      loadedWorkspace.current = workspace?.id;
    }
  }, [initial, workspace?.id]);

  useEffect(() => {
    setRoute(routeForWorkspace(workspace)); setReady(true);
    const onPop = () => setRoute(routeForWorkspace(workspace));
    const onLeave = e => { if (pending.current || failed.current.size) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', onLeave);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('beforeunload', onLeave); };
  }, [workspace?.slug]);
  if (!ready || loadedWorkspace.current !== workspace?.id) return null; // avoid server/browser date mismatches and stale records during workspace switches

  const report = saved => setSync({ pending: pending.current, failed: failed.current.size, expired: expired.current, saved });
  const run = op => {
    pending.current++; report(false);
    chain.current = chain.current.then(async () => {
      let ok = false;
      try {
        await send(op, workspace.id); failed.current.delete(op.id); ok = true;
        if (op.kind === 'event') setItems(a => a.some(x => x.id === op.id) ? a.map(x => x.id === op.id ? { ...x, data: op.data } : x) : [...a, { id: op.id, kind: 'event', data: op.data }]);
      }
      catch (e) { failed.current.set(op.id, op); if (e.expired) expired.current = true; }
      pending.current--;
      if (!pending.current && !failed.current.size) {
        expired.current = false; report(true);
        clearTimeout(timer.current); timer.current = setTimeout(() => report(false), 2000);
      } else report(false);
      return ok;
    });
    return chain.current;
  };
  const retry = () => {
    const ops = [...failed.current.values()];
    failed.current.clear(); expired.current = false;
    if (!ops.length) return report(false);
    ops.forEach(run);
  };
  const prepareWorkspaceSwitch = async () => {
    await chain.current;
    return pending.current === 0 && failed.current.size === 0;
  };

  const of = k => items.filter(x => x.kind === k).map(x => x.data);
  const put = (kind, o) => {
    if (kind === 'event') {
      return run({ id: o.id, kind, data: o }).then(ok => {
        if (ok) setItems(a => a.some(x => x.id === o.id) ? a.map(x => x.id === o.id ? { ...x, data: o } : x) : [...a, { id: o.id, kind, data: o }]);
        return ok;
      });
    }
    setItems(a => a.some(x => x.id === o.id) ? a.map(x => x.id === o.id ? { ...x, data: o } : x) : [...a, { id: o.id, kind, data: o }]);
    return run({ id: o.id, kind, data: o });
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
          <WorkspaceSwitcher workspace={workspace} workspaces={workspaces} onBeforeSwitch={prepareWorkspaceSwitch} />
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
          {tab === 'diary' && <Diary {...p} workspace={workspace} />}
          {tab === 'cal' && <Calendar {...p} workspace={workspace} />}
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
