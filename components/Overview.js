'use client';

const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
// Read a form's values, run fn, then clear the form.
const sub = fn => e => { e.preventDefault(); fn(Object.fromEntries(new FormData(e.target))); e.target.reset(); };
const short = s => new Date(s + 'T00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const Empty = ({ children }) => <div className="empty"><p>{children}</p></div>;
const sum = a => a.reduce((t, x) => t + x.amt, 0);

export default function Overview({ of, put, money, go }) {
  const now = new Date(), today = ymd(now), month = today.slice(0, 7);
  const prevMonth = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  const wkStart = new Date(); wkStart.setDate(wkStart.getDate() - (wkStart.getDay() + 6) % 7);
  const wk = ymd(wkStart);

  const sales = of('sale'), exps = of('expense'), projects = of('project');
  const inMonth = (a, m) => a.filter(x => x.date.startsWith(m));
  const sMonth = sum(inMonth(sales, month)), sPrev = sum(inMonth(sales, prevMonth)), eMonth = sum(inMonth(exps, month));
  const profit = sMonth - eMonth;
  const change = sPrev ? Math.round((sMonth - sPrev) / sPrev * 100) : null;

  // Active engagements: what is still owed, and which installments are unpaid.
  const active = projects.filter(q => !q.done);
  const paidFor = q => sales.filter(s => s.pid === q.id || (!s.pid && s.label === q.name));
  let toCollect = 0;
  const dues = [];
  active.forEach(q => {
    const paid = paidFor(q);
    toCollect += Math.max((q.val || 0) - sum(paid), 0);
    (q.plan || []).filter(i => !paid.some(s => s.iid === i.id)).forEach(i => dues.push({ q, i }));
  });
  dues.sort((a, b) => (a.i.due || '9999').localeCompare(b.i.due || '9999'));

  const info = q => {
    if (q.end && q.end < today) return [`Past finish date (${short(q.end)})`, true];
    if (q.type === 'service') {
      const wl = (q.checks || []).filter(c => c.f === 'weekly'), log = q.log || {};
      const d = wl.filter(c => log[c.id + ':' + wk]).length;
      return [wl.length ? `Weekly checks: ${d} of ${wl.length} done` : 'Ongoing service', false];
    }
    const open = (q.ms || []).filter(m => !m.d).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'))[0];
    if (!open) return [(q.ms || []).length ? 'All milestones done' : 'No milestones set', false];
    return [`Next: ${open.t}${open.due ? ' · ' + short(open.due) : ''}`, !!open.due && open.due < today];
  };

  const tasks = of('task').filter(t => t.date === today), tDone = tasks.filter(t => t.d).length;
  const goals = of('goal').filter(g => (g.type === 'weekly' && g.p === wk) || (g.type === 'monthly' && g.p === month));

  const months = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + k, 1), key = ymd(d).slice(0, 7);
    return { key, label: d.toLocaleDateString(undefined, { month: 'short' }), full: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), v: sum(inMonth(sales, key)) };
  });
  const max = Math.max(...months.map(m => m.v));

  return (
    <>
      <div className="stats4">
        <div className="stat"><span>Sales this month</span><b className="pos">{money(sMonth)}</b>
          <small>{change === null ? (sMonth ? 'No sales last month' : 'Nothing recorded yet') : `${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}% vs last month`}</small></div>
        <div className="stat"><span>Profit this month</span><b className={profit < 0 ? 'neg' : ''}>{money(profit)}</b><small>After {money(eMonth)} expenses</small></div>
        <div className="stat"><span>To collect</span><b>{money(toCollect)}</b><small>{active.length} active engagement{active.length === 1 ? '' : 's'}</small></div>
        <div className="stat"><span>Tasks today</span><b>{tasks.length ? `${tDone} of ${tasks.length}` : '—'}</b><small>{tasks.length ? (tDone === tasks.length ? 'All done' : `${tasks.length - tDone} left`) : 'Nothing planned'}</small></div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="top" style={{ marginBottom: 6 }}><h2 style={{ margin: 0 }}>Today</h2><button className="btn sm" onClick={() => go('cal')}>Open calendar</button></div>
          {tasks.map(t => (
            <div className="row" key={t.id}>
              <input type="checkbox" checked={t.d} onChange={() => put('task', { ...t, d: !t.d })} />
              <span className={'g ' + (t.d ? 'done' : '')}>{t.t}</span>
            </div>
          ))}
          {!tasks.length && <Empty>Nothing planned for today.</Empty>}
          <form onSubmit={sub(d => put('task', { id: uid(), date: today, t: d.t, d: false }))}>
            <input name="t" placeholder="Add a task for today…" required /><button className="btn pri">Add</button>
          </form>
        </div>

        <div className="card">
          <h2>Payments to collect</h2>
          {dues.map(({ q, i }) => (
            <div className="row" key={i.id}>
              <div className="g"><b>{q.name}</b><span className={'mut ' + (i.due && i.due < today ? 'neg' : '')}>{i.label || 'Installment'}{i.due ? (i.due < today ? ' · overdue since ' : ' · due ') + short(i.due) : ''}</span></div>
              <span className="amt">{money(i.amt)}</span>
              <button className="btn sm" onClick={() => put('sale', { id: uid(), date: today, label: q.name, amt: i.amt, note: i.label || 'Installment', pid: q.id, iid: i.id })}>Received</button>
            </div>
          ))}
          {!dues.length && <Empty>No installments waiting. Add a payment plan to an engagement to see it here.</Empty>}
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="top" style={{ marginBottom: 6 }}><h2 style={{ margin: 0 }}>Goals</h2><button className="btn sm" onClick={() => go('goals')}>All goals</button></div>
          {goals.map(g => {
            const pc = Math.min(100, g.cur / g.tar * 100);
            return (
              <div className="row" key={g.id}>
                <div className="g"><span><b className={pc >= 100 ? 'pos' : ''}>{g.title}</b> <span className="mut">{g.cur}/{g.tar} {g.unit} · {g.type === 'weekly' ? 'this week' : 'this month'}</span></span><div className="bar"><b style={{ width: pc + '%' }} /></div></div>
                <button className="btn sm" onClick={() => put('goal', { ...g, cur: g.cur + 1 })} aria-label="Add one">+</button>
              </div>
            );
          })}
          {!goals.length && <Empty>No goals set for this week or month.</Empty>}
        </div>

        <div className="card">
          <div className="top" style={{ marginBottom: 6 }}><h2 style={{ margin: 0 }}>Active engagements <span className="pill">{active.length}</span></h2><button className="btn sm" onClick={() => go('proj')}>View all</button></div>
          {active.map(q => {
            const [text, warn] = info(q);
            return (
              <div className="row" key={q.id}>
                <div className="g"><b>{q.name} <span className="mut">{q.client}</span></b><span className={'mut ' + (warn ? 'neg' : '')}>{text}</span></div>
                {q.service && <span className="pill">{q.service}</span>}
              </div>
            );
          })}
          {!active.length && <Empty>No active engagements.</Empty>}
        </div>
      </div>

      <div className="card">
        <h2>Sales, last 6 months</h2>
        {max > 0 ? (
          <>
            <div className="bars" role="group" aria-label="Monthly sales, last six months">
              {months.map((m, k) => {
                const h = m.v / max * 100;
                return (
                  <div className="bcol" key={m.key} tabIndex={0} style={{ '--h': h + '%' }}>
                    <i style={{ height: h + '%' }} />
                    {k === 5 && m.v > 0 && <b className="bv">{money(m.v)}</b>}
                    <span className="tip">{m.full}: {money(m.v)}</span>
                  </div>
                );
              })}
            </div>
            <div className="bx">{months.map(m => <span key={m.key}>{m.label}</span>)}</div>
            <table className="sr"><caption>Sales by month</caption><tbody>{months.map(m => <tr key={m.key}><th scope="row">{m.full}</th><td>{money(m.v)}</td></tr>)}</tbody></table>
          </>
        ) : <Empty>No sales recorded yet.</Empty>}
      </div>
    </>
  );
}
