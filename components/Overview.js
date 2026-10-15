'use client';
import { Empty, More, period, shortDay, submit, sum, uid, ymd } from './ui';

export default function Overview({ of, put, money, go }) {
  const now = new Date(), today = ymd(now), month = today.slice(0, 7);
  const prevMonth = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7);
  const wk = period('weekly', 0).key;

  const sales = of('sale'), exps = of('expense'), projects = of('project');
  const inMonth = (a, m) => a.filter(x => x.date.startsWith(m));
  const sMonth = sum(inMonth(sales, month)), sPrev = sum(inMonth(sales, prevMonth));
  // Personal expenses (owner withdrawals) are kept out of profit.
  const monthExps = inMonth(exps, month);
  const bizMonth = sum(monthExps.filter(x => x.scope !== 'personal')), perMonth = sum(monthExps.filter(x => x.scope === 'personal'));
  const profit = sMonth - bizMonth;
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
    if (q.end && q.end < today) return [`Past finish date (${shortDay(q.end)})`, true];
    if (q.type === 'service') {
      const wl = (q.checks || []).filter(c => c.f === 'weekly'), log = q.log || {};
      const d = wl.filter(c => log[c.id + ':' + wk]).length;
      return [wl.length ? `Weekly checks: ${d} of ${wl.length} done` : 'Ongoing service', false];
    }
    const open = (q.ms || []).filter(m => !m.d).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'))[0];
    if (!open) return [(q.ms || []).length ? 'All milestones done' : 'No milestones set', false];
    return [`Next: ${open.t}${open.due ? ' · ' + shortDay(open.due) : ''}`, !!open.due && open.due < today];
  };
  const dest = q => go('proj', q.type === 'service' ? 'services' : 'projects');

  const tasks = of('task').filter(t => t.date === today), tDone = tasks.filter(t => t.d).length;
  const goals = of('goal').filter(g => (g.type === 'weekly' && g.p === wk) || (g.type === 'monthly' && g.p === month) || (g.type === 'annual' && g.p === String(now.getFullYear())));

  // Each card shows the first few items; the rest sit behind a link, so the page stays short.
  const CAP = { tasks: 5, dues: 4, goals: 3, active: 4 };

  return (
    <>
      <div className="stats4">
        <div className="stat"><span>Sales this month</span><b className="pos">{money(sMonth)}</b>
          <small>{change === null ? (sMonth ? 'No sales last month' : 'Nothing recorded yet') : `${change >= 0 ? '↑' : '↓'} ${Math.abs(change)}% vs last month`}</small></div>
        <div className="stat"><span>Profit this month</span><b className={profit < 0 ? 'neg' : ''}>{money(profit)}</b>
          <small>After {money(bizMonth)} business expenses{perMonth ? ` · ${money(perMonth)} taken out` : ''}</small></div>
        <div className="stat"><span>To collect</span><b>{money(toCollect)}</b><small>{active.length} active engagement{active.length === 1 ? '' : 's'}</small></div>
        <div className="stat"><span>Tasks today</span><b>{tasks.length ? `${tDone} of ${tasks.length}` : '—'}</b><small>{tasks.length ? (tDone === tasks.length ? 'All done' : `${tasks.length - tDone} left`) : 'Nothing planned'}</small></div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="top" style={{ marginBottom: 6 }}><h2 style={{ margin: 0 }}>Today</h2><button className="btn sm" onClick={() => go('cal')}>Open calendar</button></div>
          {tasks.slice(0, CAP.tasks).map(t => (
            <div className="row" key={t.id}>
              <input type="checkbox" checked={t.d} onChange={() => put('task', { ...t, d: !t.d })} />
              <span className={'g ' + (t.d ? 'done' : '')}>{t.t}</span>
            </div>
          ))}
          <More n={tasks.length - CAP.tasks} onClick={() => go('cal')} />
          {!tasks.length && <Empty>Nothing planned for today.</Empty>}
          <form onSubmit={submit(d => put('task', { id: uid(), date: today, t: d.t, d: false }))}>
            <input name="t" placeholder="Add a task for today…" required /><button className="btn pri">Add</button>
          </form>
        </div>

        <div className="card">
          <div className="top" style={{ marginBottom: 6 }}><h2 style={{ margin: 0 }}>Payments to collect</h2></div>
          {dues.slice(0, CAP.dues).map(({ q, i }) => (
            <div className="row" key={i.id}>
              <div className="g"><b>{q.name}</b><span className={'mut ' + (i.due && i.due < today ? 'neg' : '')}>{i.label || 'Installment'}{i.due ? (i.due < today ? ' · overdue since ' : ' · due ') + shortDay(i.due) : ''}</span></div>
              <span className="amt">{money(i.amt)}</span>
              <button className="btn sm" onClick={() => put('sale', { id: uid(), date: today, label: q.name, amt: i.amt, note: i.label || 'Installment', pid: q.id, iid: i.id })}>Received</button>
            </div>
          ))}
          <More n={dues.length - CAP.dues} onClick={() => go('proj')}>{`${dues.length - CAP.dues} more installments`}</More>
          {!dues.length && <Empty>No installments waiting. Add a payment plan to an engagement to see it here.</Empty>}
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="top" style={{ marginBottom: 6 }}><h2 style={{ margin: 0 }}>Goals</h2><button className="btn sm" onClick={() => go('goals')}>All goals</button></div>
          {goals.slice(0, CAP.goals).map(g => {
            const pc = Math.min(100, g.cur / g.tar * 100);
            return (
              <div className="row" key={g.id}>
                <div className="g"><span><b className={pc >= 100 ? 'pos' : ''}>{g.title}</b> <span className="mut">{g.cur}/{g.tar} {g.unit} · {g.type === 'weekly' ? 'this week' : g.type === 'annual' ? 'this year' : 'this month'}</span></span><div className="bar"><b style={{ width: pc + '%' }} /></div></div>
                <button className="btn sm" onClick={() => put('goal', { ...g, cur: g.cur + 1 })} aria-label="Add one">+</button>
              </div>
            );
          })}
          <More n={goals.length - CAP.goals} onClick={() => go('goals')} />
          {!goals.length && <Empty>No goals set for this week or month.</Empty>}
        </div>

        <div className="card">
          <div className="top" style={{ marginBottom: 6 }}><h2 style={{ margin: 0 }}>Active engagements <span className="pill">{active.length}</span></h2><button className="btn sm" onClick={() => go('proj')}>View all</button></div>
          {active.slice(0, CAP.active).map(q => {
            const [text, warn] = info(q);
            return (
              <div className="row" key={q.id}>
                <div className="g"><b>{q.name} <span className="mut">{q.client}</span></b><span className={'mut ' + (warn ? 'neg' : '')}>{text}</span></div>
                {q.service && <span className="pill">{q.service}</span>}
                <button className="btn sm" onClick={() => dest(q)} aria-label={`Open ${q.name}`}>Open</button>
              </div>
            );
          })}
          <More n={active.length - CAP.active} onClick={() => go('proj')} />
          {!active.length && <Empty>No active engagements.</Empty>}
        </div>
      </div>
    </>
  );
}
