'use client';
import { useState } from 'react';

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
// Read a form's values, run fn, then clear the form.
const sub = fn => e => { e.preventDefault(); fn(Object.fromEntries(new FormData(e.target))); e.target.reset(); };
const fmtD = (d, o) => d.toLocaleDateString(undefined, o);
const short = s => fmtD(new Date(s + 'T00:00'), { day: 'numeric', month: 'short', year: 'numeric' });
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 864e5);
const Empty = ({ children }) => <div className="empty"><p>{children}</p></div>;

// Suggested checklist for an ongoing service (edit freely per engagement).
const DEFAULT_CHECKS = [
  ['Tracking configured', 'once'], ['Ads launched', 'once'],
  ['Ad performance monitored', 'weekly'], ['Ads optimized', 'weekly'],
  ['Review meeting held', 'monthly'],
];
const seed = () => DEFAULT_CHECKS.map(([t, f], i) => ({ id: uid() + i, t, f }));

function period(type, off) {
  const f = d => fmtD(d, { day: 'numeric', month: 'short' });
  if (type === 'weekly') {
    const a = new Date(); a.setDate(a.getDate() - (a.getDay() + 6) % 7 + off * 7);
    const b = new Date(a); b.setDate(b.getDate() + 6);
    return { key: ymd(a), label: `${f(a)} – ${f(b)}` };
  }
  const n = new Date(), d = new Date(n.getFullYear(), n.getMonth() + off, 1);
  return { key: ymd(d).slice(0, 7), label: fmtD(d, { month: 'long', year: 'numeric' }) };
}

export default function Projects({ of, put, del, money }) {
  const today = ymd(new Date());
  const [open, setOpen] = useState(null);
  const sales = of('sale'), all = of('project');
  const services = [...new Set(['Web development', 'Ads management', ...all.map(q => q.service).filter(Boolean)])];
  // A project's payments are its sales: linked by project id (or by matching name, for older entries).
  const paidFor = q => sales.filter(s => s.pid === q.id || (!s.pid && s.label === q.name));
  const card = q => <Card key={q.id} q={q} paid={paidFor(q)} open={open === q.id} toggle={() => setOpen(open === q.id ? null : q.id)} {...{ put, del, money, today }} />;
  const A = all.filter(q => !q.done), D = all.filter(q => q.done);
  return (
    <>
      <datalist id="svc">{services.map(s => <option key={s} value={s} />)}</datalist>
      <div className="card"><h2>New engagement</h2>
        <form style={{ marginTop: 0 }} onSubmit={sub(d => put('project', {
          id: uid(), name: d.name, client: d.client, val: +d.val || 0, type: d.type, service: d.service,
          start: d.start, end: d.end, note: d.note, done: false, ms: [], plan: [], log: {},
          checks: d.type === 'service' ? seed() : [],
        }))}>
          <input name="name" placeholder="Engagement name" required /><input name="client" placeholder="Client" />
          <select name="type"><option value="project">Project (milestones)</option><option value="service">Ongoing service (checklists)</option></select>
          <input name="service" list="svc" placeholder="Service (e.g. Ads management)" />
          <input name="val" type="number" min="0" placeholder="Contract value" />
          <label className="fl">Start<input type="date" name="start" /></label><label className="fl">Finish (optional)<input type="date" name="end" /></label>
          <input name="note" placeholder="Notes" /><button className="btn pri" style={{ alignSelf: 'flex-end' }}>Add engagement</button>
        </form>
      </div>
      <h2 className="sec">In progress <span className="pill">{A.length}</span></h2>
      {A.map(card)}{!A.length && <div className="card"><Empty>No active engagements.</Empty></div>}
      <h2 className="sec">Completed <span className="pill">{D.length}</span></h2>
      {D.map(q => open === q.id ? card(q) : (
        <button key={q.id} className="crow" onClick={() => setOpen(q.id)}>
          <span><b>{q.name}</b> <span className="mut">{q.client}</span></span><span className="mut">View details ›</span>
        </button>
      ))}
      {!D.length && <div className="card"><Empty>Nothing completed yet.</Empty></div>}
    </>
  );
}

function Card({ q, paid, open, toggle, put, del, money, today }) {
  const upd = patch => put('project', { ...q, ...patch });
  const isSvc = q.type === 'service';
  const received = paid.reduce((t, s) => t + s.amt, 0), val = q.val || 0, bal = Math.max(val - received, 0);
  const plan = q.plan || [], ms = q.ms || [], checks = q.checks || [], log = q.log || {};
  const paidBy = i => paid.find(s => s.iid === i.id);
  const next = q.done ? null : plan.filter(i => !paidBy(i)).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'))[0];
  const msDone = ms.filter(m => m.d).length;
  const wk = period('weekly', 0).key, wl = checks.filter(c => c.f === 'weekly'), wd = wl.filter(c => log[c.id + ':' + wk]).length;
  const status = !val ? null : received >= val ? ['Paid in full', 'ok'] : received > 0 ? ['Part paid', ''] : ['Unpaid', 'warn'];
  let when = null;
  if (!q.done && q.end) { const left = daysBetween(today, q.end); when = left < 0 ? [`${-left} days overdue`, 'neg'] : left === 0 ? ['Due today', ''] : [`${left} days left`, '']; }
  const span = q.start || q.end ? `${q.start ? short(q.start) : '?'} → ${q.end ? short(q.end) : isSvc ? 'ongoing' : '?'}` : isSvc ? 'Ongoing' : 'Not set';
  return (
    <div className="card">
      <div className="top" style={{ marginBottom: 12 }}>
        <div><b>{q.name}</b> <span className="mut">{q.client}</span></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {q.service && <span className="pill">{q.service}</span>}
          {status && <span className={'pill ' + status[1]}>{status[0]}</span>}
          <button className="btn sm" onClick={toggle}>{open ? 'Close' : 'Details'}</button>
        </div>
      </div>
      <div className="meta">
        <div><span>Received</span><b>{money(received)}</b></div>
        <div><span>Balance</span><b>{money(bal)}</b>
          {next && <small className={next.due && next.due < today ? 'neg' : ''}>Next: {money(next.amt)}{next.due ? ' · ' + short(next.due) : ''}</small>}</div>
        <div><span>Duration</span><b>{span}</b>{when && <small className={when[1]}>{when[0]}</small>}</div>
        {isSvc
          ? <div><span>This week</span><b>{wl.length ? `${wd} of ${wl.length} done` : '—'}</b></div>
          : <div><span>Milestones</span><b>{ms.length ? `${msDone} of ${ms.length} done` : '—'}</b></div>}
      </div>
      {val > 0 && <div className="bar"><b style={{ width: Math.min(100, received / val * 100) + '%' }} /></div>}
      {open && (
        <div className="detail">
          <div className="dgrid">
            <label className="fl">Type<select value={isSvc ? 'service' : 'project'} onChange={e => upd({ type: e.target.value })}><option value="project">Project</option><option value="service">Ongoing service</option></select></label>
            <label className="fl">Service<input list="svc" defaultValue={q.service || ''} onBlur={e => upd({ service: e.target.value })} /></label>
            <label className="fl">Start<input type="date" value={q.start || ''} onChange={e => upd({ start: e.target.value })} /></label>
            <label className="fl">Finish<input type="date" value={q.end || ''} onChange={e => upd({ end: e.target.value })} /></label>
            <label className="fl">Contract value<input type="number" min="0" defaultValue={q.val || 0} onBlur={e => upd({ val: +e.target.value || 0 })} /></label>
            <label className="fl" style={{ flex: 1, minWidth: 180 }}>Notes<input defaultValue={q.note || ''} onBlur={e => upd({ note: e.target.value })} /></label>
          </div>

          <h3>Payment plan</h3>
          {plan.map(i => {
            const s = paidBy(i);
            return (
              <div className="row" key={i.id}>
                <div className="g"><b>{i.label || 'Installment'}</b><span className={'mut ' + (!s && i.due && i.due < today ? 'neg' : '')}>{money(i.amt)}{i.due ? ` · due ${short(i.due)}` : ''}</span></div>
                {s ? <span className="pill ok">Received {short(s.date)}</span>
                  : <button className="btn sm" onClick={() => put('sale', { id: uid(), date: today, label: q.name, amt: i.amt, note: i.label || 'Installment', pid: q.id, iid: i.id })}>Mark received</button>}
                <button className="x" onClick={() => upd({ plan: plan.filter(x => x.id !== i.id) })} aria-label="Delete installment">×</button>
              </div>
            );
          })}
          {!plan.length && <p className="mut">No installments planned. Add them below, e.g. a deposit and a final payment.</p>}
          <form onSubmit={sub(d => upd({ plan: [...plan, { id: uid(), label: d.label || `Installment ${plan.length + 1}`, amt: +d.amt, due: d.due }] }))}>
            <input name="label" placeholder="Label (e.g. 1st installment)" /><input name="amt" type="number" min="0" step="any" placeholder="Amount" required />
            <label className="fl">Due<input type="date" name="due" /></label><button className="btn pri" style={{ alignSelf: 'flex-end' }}>Add installment</button>
          </form>

          <h3>Payments received</h3>
          {paid.slice().sort((a, b) => b.date.localeCompare(a.date)).map(s => (
            <div className="row" key={s.id}>
              <div className="g"><b>{money(s.amt)}</b><span className="mut">{s.date}{s.note ? ' · ' + s.note : ''}</span></div>
              <button className="x" onClick={() => del(s.id)} aria-label="Delete payment">×</button>
            </div>
          ))}
          {!paid.length && <p className="mut">No payments recorded yet.</p>}
          <form onSubmit={sub(d => put('sale', { id: uid(), date: d.date, label: q.name, amt: +d.amt, note: d.note, pid: q.id }))}>
            <input type="date" name="date" defaultValue={today} required /><input name="amt" type="number" min="0" step="any" placeholder="Other payment received" required />
            <input name="note" placeholder="Note" /><button className="btn pri">Record payment</button>
          </form>

          {isSvc ? <Checklist q={q} upd={upd} /> : (
            <>
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
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <button className="btn sm" onClick={() => upd({ done: !q.done })}>{q.done ? 'Reopen' : 'Mark as completed'}</button>
            <button className="btn sm" onClick={() => { if (confirm('Delete this engagement? Its recorded payments stay in Money.')) del(q.id); }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Weekly, monthly and one-off setup checklists. Ticks are stored per period, so past weeks keep their history.
function Checklist({ q, upd }) {
  const [off, setOff] = useState({ weekly: 0, monthly: 0 });
  const checks = q.checks || [], log = q.log || {};
  const toggle = (c, key) => { const k = c.id + ':' + key; upd({ log: { ...log, [k]: !log[k] } }); };
  return (
    <>
      <h3>Checklist</h3>
      {['once', 'weekly', 'monthly'].map(f => {
        const list = checks.filter(c => c.f === f);
        if (!list.length) return null;
        const p = f === 'once' ? { key: 'once' } : period(f, off[f]);
        const n = list.filter(c => log[c.id + ':' + p.key]).length;
        return (
          <div key={f}>
            <div className="gh">
              <b>{f === 'once' ? 'Setup' : f === 'weekly' ? 'Weekly' : 'Monthly'} <span className="mut">{n} of {list.length}</span></b>
              {f !== 'once' && <span><button className="btn sm" onClick={() => setOff({ ...off, [f]: off[f] - 1 })}>‹</button><span className="mut">{p.label}</span><button className="btn sm" onClick={() => setOff({ ...off, [f]: off[f] + 1 })}>›</button></span>}
            </div>
            {list.map(c => (
              <div className="row" key={c.id}>
                <input type="checkbox" checked={!!log[c.id + ':' + p.key]} onChange={() => toggle(c, p.key)} />
                <span className={'g ' + (log[c.id + ':' + p.key] ? 'done' : '')}>{c.t}</span>
                <button className="x" onClick={() => upd({ checks: checks.filter(x => x.id !== c.id) })} aria-label="Remove item">×</button>
              </div>
            ))}
          </div>
        );
      })}
      {!checks.length && <p className="mut">No checklist yet. <button type="button" className="btn sm" onClick={() => upd({ checks: seed() })}>Add suggested checklist</button></p>}
      <form onSubmit={sub(d => upd({ checks: [...checks, { id: uid(), t: d.t, f: d.f }] }))}>
        <input name="t" placeholder="Checklist item" required />
        <select name="f"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="once">One-off setup</option></select>
        <button className="btn pri">Add item</button>
      </form>
    </>
  );
}
