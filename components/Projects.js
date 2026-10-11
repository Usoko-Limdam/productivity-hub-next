'use client';
import { useState } from 'react';

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
// Read a form's values, run fn, then clear the form.
const sub = fn => e => { e.preventDefault(); fn(Object.fromEntries(new FormData(e.target))); e.target.reset(); };
const short = s => new Date(s + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);
const Empty = ({ children }) => <div className="empty"><p>{children}</p></div>;

export default function Projects({ of, put, del, money }) {
  const today = ymd(new Date());
  const [open, setOpen] = useState(null);
  const sales = of('sale'), all = of('project');
  // A project's payments are its sales: linked by project id (or by matching name, for older entries).
  const paidFor = q => sales.filter(s => s.pid === q.id || (!s.pid && s.label === q.name));
  const card = q => <Card key={q.id} q={q} paid={paidFor(q)} open={open === q.id} toggle={() => setOpen(open === q.id ? null : q.id)} {...{ put, del, money, today }} />;
  const A = all.filter(q => !q.done), D = all.filter(q => q.done);
  return (
    <>
      <div className="card"><h2>New project</h2>
        <form style={{ marginTop: 0 }} onSubmit={sub(d => put('project', { id: uid(), name: d.name, client: d.client, val: +d.val || 0, start: d.start, end: d.end, note: d.note, done: false, ms: [] }))}>
          <input name="name" placeholder="Project name" required /><input name="client" placeholder="Client" /><input name="val" type="number" min="0" placeholder="Contract value" />
          <label className="fl">Start<input type="date" name="start" /></label><label className="fl">Finish<input type="date" name="end" /></label>
          <input name="note" placeholder="Notes" /><button className="btn pri" style={{ alignSelf: 'flex-end' }}>Add project</button>
        </form>
      </div>
      <h2 className="sec">In progress <span className="pill">{A.length}</span></h2>
      {A.map(card)}{!A.length && <div className="card"><Empty>No active projects.</Empty></div>}
      <h2 className="sec">Completed <span className="pill">{D.length}</span></h2>
      {D.map(card)}{!D.length && <div className="card"><Empty>Nothing completed yet.</Empty></div>}
    </>
  );
}

function Card({ q, paid, open, toggle, put, del, money, today }) {
  const upd = patch => put('project', { ...q, ...patch });
  const received = paid.reduce((t, s) => t + s.amt, 0), val = q.val || 0, bal = Math.max(val - received, 0);
  const ms = q.ms || [], msDone = ms.filter(m => m.d).length;
  const status = !val ? null : received >= val ? ['Paid in full', 'ok'] : received > 0 ? ['Part paid', ''] : ['Unpaid', 'warn'];
  let when = null;
  if (!q.done && q.end) { const left = daysBetween(today, q.end); when = left < 0 ? [`${-left} days overdue`, 'neg'] : left === 0 ? ['Due today', ''] : [`${left} days left`, '']; }
  const span = q.start || q.end ? `${q.start ? short(q.start) : '?'} → ${q.end ? short(q.end) : '?'}` : 'Not set';
  return (
    <div className="card">
      <div className="top" style={{ marginBottom: 12 }}>
        <div><b>{q.name}</b> <span className="mut">{q.client}</span></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {status && <span className={'pill ' + status[1]}>{status[0]}</span>}
          <button className="btn sm" onClick={toggle}>{open ? 'Close' : 'Details'}</button>
        </div>
      </div>
      <div className="meta">
        <div><span>Received</span><b>{money(received)}</b></div>
        <div><span>Balance</span><b>{money(bal)}</b></div>
        <div><span>Duration</span><b>{span}</b>{when && <small className={when[1]}>{when[0]}</small>}</div>
        <div><span>Milestones</span><b>{ms.length ? `${msDone} of ${ms.length} done` : '—'}</b></div>
      </div>
      {val > 0 && <div className="bar"><b style={{ width: Math.min(100, received / val * 100) + '%' }} /></div>}
      {open && (
        <div className="detail">
          <div className="dgrid">
            <label className="fl">Start<input type="date" value={q.start || ''} onChange={e => upd({ start: e.target.value })} /></label>
            <label className="fl">Finish<input type="date" value={q.end || ''} onChange={e => upd({ end: e.target.value })} /></label>
            <label className="fl">Contract value<input type="number" min="0" defaultValue={q.val || 0} onBlur={e => upd({ val: +e.target.value || 0 })} /></label>
            <label className="fl" style={{ flex: 1, minWidth: 180 }}>Notes<input defaultValue={q.note || ''} onBlur={e => upd({ note: e.target.value })} /></label>
          </div>

          <h3>Payments</h3>
          {paid.slice().sort((a, b) => b.date.localeCompare(a.date)).map(s => (
            <div className="row" key={s.id}>
              <div className="g"><b>{money(s.amt)}</b><span className="mut">{s.date}{s.note ? ' · ' + s.note : ''}</span></div>
              <button className="x" onClick={() => del(s.id)} aria-label="Delete payment">×</button>
            </div>
          ))}
          {!paid.length && <p className="mut">No payments recorded yet.</p>}
          <form onSubmit={sub(d => put('sale', { id: uid(), date: d.date, label: q.name, amt: +d.amt, note: d.note, pid: q.id }))}>
            <input type="date" name="date" defaultValue={today} required /><input name="amt" type="number" min="0" step="any" placeholder="Amount received" required />
            <input name="note" placeholder="Note (e.g. deposit)" /><button className="btn pri">Record payment</button>
          </form>

          <h3>Milestones</h3>
          {ms.map(m => (
            <div className="row" key={m.id}>
              <input type="checkbox" checked={m.d} onChange={() => upd({ ms: ms.map(x => x.id === m.id ? { ...x, d: !x.d } : x) })} />
              <div className="g"><span className={m.d ? 'done' : ''}>{m.t}</span>{m.due && <span className={'mut ' + (!m.d && m.due < today ? 'neg' : '')}>Due {short(m.due)}</span>}</div>
              <button className="x" onClick={() => upd({ ms: ms.filter(x => x.id !== m.id) })} aria-label="Delete milestone">×</button>
            </div>
          ))}
          {!ms.length && <p className="mut">No milestones yet.</p>}
          <form onSubmit={sub(d => upd({ ms: [...ms, { id: uid(), t: d.t, due: d.due, d: false }] }))}>
            <input name="t" placeholder="Milestone (e.g. Design approved)" required /><input type="date" name="due" /><button className="btn pri">Add milestone</button>
          </form>

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button className="btn sm" onClick={() => upd({ done: !q.done })}>{q.done ? 'Reopen project' : 'Mark as completed'}</button>
            <button className="btn sm" onClick={() => { if (confirm('Delete this project? Its recorded payments stay in Money.')) del(q.id); }}>Delete project</button>
          </div>
        </div>
      )}
    </div>
  );
}
