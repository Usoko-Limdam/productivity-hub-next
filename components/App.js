'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const H = { 'Content-Type': 'application/json' };
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const fmt = (d, o) => d.toLocaleDateString(undefined, o);
// Read a form's values, run fn, then clear the form.
const sub = fn => e => { e.preventDefault(); fn(Object.fromEntries(new FormData(e.target))); e.target.reset(); };
const TABS = { cal: 'Calendar', goals: 'Goals', proj: 'Projects', money: 'Money' };

export default function App({ initial }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState('cal');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []); // avoids server/browser date mismatches
  if (!ready) return null;

  const of = k => items.filter(x => x.kind === k).map(x => x.data);
  const put = (kind, o) => {
    setItems(a => a.some(x => x.id === o.id) ? a.map(x => x.id === o.id ? { ...x, data: o } : x) : [...a, { id: o.id, kind, data: o }]);
    fetch('/api/items', { method: 'POST', headers: H, body: JSON.stringify({ kind, id: o.id, data: o }) });
  };
  const del = id => { setItems(a => a.filter(x => x.id !== id)); fetch('/api/items?id=' + encodeURIComponent(id), { method: 'DELETE' }); };
  const cur = of('setting').find(s => s.id === 'cur')?.v ?? '₦';
  const money = n => cur + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const p = { of, put, del, money };

  const exportData = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify({ items })], { type: 'application/json' }));
    a.download = 'productivity-backup.json'; a.click();
  };
  const importData = e => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result), o = [];
        if (Array.isArray(j.items)) j.items.forEach(x => o.push([x.kind, x.data]));
        else { // backup from the earlier browser-only version
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
    <>
      <h1>My Productivity Hub</h1>
      <nav>{Object.entries(TABS).map(([k, v]) => <button key={k} className={k === tab ? 'on' : ''} onClick={() => setTab(k)}>{v}</button>)}</nav>
      {tab === 'cal' && <Calendar {...p} />}
      {tab === 'goals' && <Goals {...p} />}
      {tab === 'proj' && <Projects {...p} />}
      {tab === 'money' && <Money {...p} />}
      <div className="mut" style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn sm" onClick={exportData}>Export backup</button>
        <label className="btn sm">Import<input type="file" accept=".json" hidden onChange={importData} /></label>
        <select value={cur} onChange={e => put('setting', { id: 'cur', v: e.target.value })}><option>₦</option><option>$</option><option>£</option></select>
        <button className="btn sm" onClick={logout}>Log out</button>
      </div>
    </>
  );
}

function Calendar({ of, put, del }) {
  const today = ymd(new Date());
  const [[y, m], setV] = useState(() => { const n = new Date(); return [n.getFullYear(), n.getMonth()]; });
  const [sel, setSel] = useState(today);
  const tasks = of('task');
  const off = (new Date(y, m, 1).getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
  const move = d => { const x = new Date(y, m + d, 1); setV([x.getFullYear(), x.getMonth()]); };
  const day = tasks.filter(t => t.date === sel);
  return (
    <div className="grid2">
      <div className="card">
        <div className="top"><button className="btn sm" onClick={() => move(-1)}>‹</button><b>{fmt(new Date(y, m, 1), { month: 'long', year: 'numeric' })}</b><button className="btn sm" onClick={() => move(1)}>›</button></div>
        <div className="cal">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="h">{d}</div>)}
          {Array.from({ length: off }, (_, i) => <span key={'o' + i} />)}
          {Array.from({ length: n }, (_, i) => {
            const k = `${y}-${pad(m + 1)}-${pad(i + 1)}`, t = tasks.filter(x => x.date === k);
            return <button key={k} className={`${k === today ? 'td ' : ''}${k === sel ? 'sel' : ''}`} onClick={() => setSel(k)}>{i + 1}<small>{t.length ? `${t.filter(x => x.d).length}/${t.length}` : '·'}</small></button>;
          })}
        </div>
      </div>
      <div className="card">
        <h2>{fmt(new Date(sel + 'T00:00'), { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
        {day.map(t => (
          <div className="row" key={t.id}>
            <input type="checkbox" checked={t.d} onChange={() => put('task', { ...t, d: !t.d })} />
            <span className={'g ' + (t.d ? 'done' : '')}>{t.t}</span>
            <button className="x" onClick={() => del(t.id)}>×</button>
          </div>
        ))}
        {!day.length && <p className="mut">No tasks yet for this day.</p>}
        <form onSubmit={sub(d => put('task', { id: uid(), date: sel, t: d.t, d: false }))}>
          <input name="t" placeholder="Add a task…" required /><button className="btn pri">Add</button>
        </form>
      </div>
    </div>
  );
}

function period(type, off) {
  const f = d => fmt(d, { day: 'numeric', month: 'short' });
  if (type === 'weekly') {
    const a = new Date(); a.setDate(a.getDate() - (a.getDay() + 6) % 7 + off * 7);
    const b = new Date(a); b.setDate(b.getDate() + 6);
    return { key: ymd(a), label: `${f(a)} – ${f(b)}` };
  }
  const n = new Date(), d = new Date(n.getFullYear(), n.getMonth() + off, 1);
  return { key: ymd(d).slice(0, 7), label: fmt(d, { month: 'long', year: 'numeric' }) };
}

function Goals({ of, put, del }) {
  const [type, setType] = useState('weekly'), [off, setOff] = useState(0);
  const p = period(type, off), list = of('goal').filter(g => g.type === type && g.p === p.key);
  const step = (g, d) => put('goal', { ...g, cur: Math.max(0, g.cur + d) });
  return (
    <div className="card">
      <div className="top">
        <div>{['weekly', 'monthly'].map(t => <button key={t} className={'btn sm ' + (t === type ? 'pri' : '')} onClick={() => { setType(t); setOff(0); }}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
        <div><button className="btn sm" onClick={() => setOff(off - 1)}>‹</button> <b>{p.label}</b> <button className="btn sm" onClick={() => setOff(off + 1)}>›</button></div>
      </div>
      {list.map(g => {
        const pc = Math.min(100, g.cur / g.tar * 100);
        return (
          <div className="row" key={g.id}>
            <div className="g"><b className={pc >= 100 ? 'pos' : ''}>{g.title}</b> <span className="mut">{g.cur}/{g.tar} {g.unit}</span><div className="bar"><b style={{ width: pc + '%' }} /></div></div>
            <button className="btn sm" onClick={() => step(g, -1)}>−</button><button className="btn sm" onClick={() => step(g, 1)}>+</button>
            <button className="x" onClick={() => del(g.id)}>×</button>
          </div>
        );
      })}
      {!list.length && <p className="mut">No goals for this period yet.</p>}
      <form onSubmit={sub(d => put('goal', { id: uid(), type, p: p.key, title: d.title, tar: Math.max(1, +d.tar || 1), cur: 0, unit: d.unit || '' }))}>
        <input name="title" placeholder="Goal (e.g. Close 3 deals)" required /><input name="tar" type="number" min="1" defaultValue="1" title="Target" />
        <input name="unit" placeholder="unit (optional)" style={{ width: 130 }} /><button className="btn pri">Add goal</button>
      </form>
    </div>
  );
}

function Projects({ of, put, del, money }) {
  const all = of('project');
  const row = q => (
    <div className="row" key={q.id}>
      <div className="g"><b>{q.name}</b> <span className="mut">{q.client}{q.val ? ' · ' + money(q.val) : ''}</span>{q.note && <div className="mut">{q.note}</div>}</div>
      <button className="btn sm" onClick={() => put('project', { ...q, done: !q.done })}>{q.done ? 'Reopen' : 'Mark done'}</button>
      <button className="x" onClick={() => del(q.id)}>×</button>
    </div>
  );
  const A = all.filter(q => !q.done), D = all.filter(q => q.done);
  return (
    <>
      <div className="card"><h2>Add project</h2>
        <form style={{ marginTop: 0 }} onSubmit={sub(d => put('project', { id: uid(), name: d.name, client: d.client, val: +d.val || 0, note: d.note, done: false }))}>
          <input name="name" placeholder="Project name" required /><input name="client" placeholder="Client" /><input name="val" type="number" min="0" placeholder="Value" /><input name="note" placeholder="Notes" /><button className="btn pri">Add</button>
        </form>
      </div>
      <div className="grid2">
        <div className="card"><h2>Current ({A.length})</h2>{A.map(row)}{!A.length && <p className="mut">None.</p>}</div>
        <div className="card"><h2>Completed ({D.length})</h2>{D.map(row)}{!D.length && <p className="mut">None.</p>}</div>
      </div>
    </>
  );
}

function Money({ of, put, del, money }) {
  const today = ymd(new Date());
  const [fm, setFm] = useState(today.slice(0, 7));
  const f = a => a.filter(x => !fm || x.date.startsWith(fm));
  const sales = f(of('sale')), exps = f(of('expense'));
  const sum = a => a.reduce((t, x) => t + x.amt, 0), profit = sum(sales) - sum(exps);
  const list = a => a.slice().sort((x, y) => y.date.localeCompare(x.date)).map(x => (
    <div className="row" key={x.id}>
      <div className="g"><b>{money(x.amt)}</b> <span className="mut">{x.date} · {x.label}{x.note ? ' · ' + x.note : ''}</span></div>
      <button className="x" onClick={() => del(x.id)}>×</button>
    </div>
  ));
  const form = (kind, label, ph) => (
    <form onSubmit={sub(d => put(kind, { id: uid(), date: d.date, label: d.label, amt: +d.amt, note: d.note }))}>
      <input type="date" name="date" defaultValue={today} required />
      <input name="label" list={kind === 'sale' ? 'pl' : undefined} placeholder={ph} required />
      <input name="amt" type="number" min="0" step="any" placeholder="Amount" required />
      <input name="note" placeholder="Note" /><button className="btn pri">{label}</button>
    </form>
  );
  return (
    <>
      <div className="top"><span className="mut">Showing</span><span><input type="month" value={fm} onChange={e => setFm(e.target.value)} /> <button className="btn sm" onClick={() => setFm('')}>All time</button></span></div>
      <div className="stats">
        <div><span className="mut">Sales</span><b className="pos">{money(sum(sales))}</b></div>
        <div><span className="mut">Expenses</span><b className="neg">{money(sum(exps))}</b></div>
        <div><span className="mut">Profit</span><b className={profit < 0 ? 'neg' : 'pos'}>{money(profit)}</b></div>
      </div>
      <datalist id="pl">{of('project').map(q => <option key={q.id} value={q.name} />)}</datalist>
      <div className="grid2">
        <div className="card"><h2>Sales</h2>{list(sales)}{!sales.length && <p className="mut">Nothing yet.</p>}{form('sale', 'Add sale', 'Project / client')}</div>
        <div className="card"><h2>Expenses</h2>{list(exps)}{!exps.length && <p className="mut">Nothing yet.</p>}{form('expense', 'Add expense', 'Category (e.g. Software)')}</div>
      </div>
    </>
  );
}
