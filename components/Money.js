'use client';
import { useState } from 'react';
import { Empty, Hub, Seg, submit, sum, uid, ymd } from './ui';

const VIEWS = ['sales', 'business', 'personal'];
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

export default function Money({ of, put, del, money, sub, go }) {
  const today = ymd(new Date());
  const [fm, setFm] = useState(today.slice(0, 7));
  const view = VIEWS.includes(sub) ? sub : 'hub';
  const goto = id => go('money', id === 'hub' ? null : id);

  const inPeriod = a => a.filter(x => !fm || x.date.startsWith(fm));
  const sales = inPeriod(of('sale')), exps = inPeriod(of('expense'));
  // Personal expenses (owner withdrawals) are money out of the business, but they are not a cost of running it.
  const biz = exps.filter(x => x.scope !== 'personal'), per = exps.filter(x => x.scope === 'personal');
  const profit = sum(sales) - sum(biz), left = profit - sum(per);

  const period = (
    <div className="top">
      <span className="mut">Showing</span>
      <span style={{ display: 'flex', gap: 8 }}>
        <input type="month" value={fm} onChange={e => setFm(e.target.value)} aria-label="Month" />
        <button className="btn sm" onClick={() => setFm('')}>All time</button>
      </span>
    </div>
  );

  if (view === 'hub') {
    return (
      <>
        {period}
        <div className="hubs">
          <Hub title="Sales" big={money(sum(sales))} note={plural(sales.length, 'entry', 'entries')} onClick={() => goto('sales')} />
          <Hub title="Business expenses" big={money(sum(biz))} note={plural(biz.length, 'entry', 'entries')} onClick={() => goto('business')} />
          <Hub title="Personal expenses" big={money(sum(per))} note={`${plural(per.length, 'entry', 'entries')} · not counted in profit`} onClick={() => goto('personal')} />
        </div>
        <div className="stats2">
          <div className="stat"><span>Profit</span><b className={profit < 0 ? 'neg' : ''}>{money(profit)}</b><small>Sales minus business expenses</small></div>
          <div className="stat"><span>Left in business</span><b className={left < 0 ? 'neg' : ''}>{money(left)}</b><small>Profit minus personal expenses</small></div>
        </div>
        <SalesChart sales={of('sale')} money={money} />
      </>
    );
  }

  const sales_ = view === 'sales', personal = view === 'personal';
  const list = sales_ ? sales : personal ? per : biz;
  const title = sales_ ? 'Sales' : personal ? 'Personal expenses' : 'Business expenses';
  const kind = sales_ ? 'sale' : 'expense';
  const suggest = sales_ ? of('project').map(q => q.name) : [...new Set(of('expense').filter(x => (x.scope === 'personal') === personal).map(x => x.label))];
  const total = sum(list);

  return (
    <>
      <Seg value={view} onChange={goto} items={[{ id: 'hub', label: 'Overview' }, { id: 'sales', label: 'Sales' }, { id: 'business', label: 'Business expenses' }, { id: 'personal', label: 'Personal expenses' }]} />
      {period}
      <div className="stats">
        <div className="stat"><span>Total</span><b className={sales_ ? 'pos' : ''}>{money(total)}</b></div>
        <div className="stat"><span>Entries</span><b>{list.length}</b></div>
        <div className="stat"><span>Average</span><b>{money(list.length ? total / list.length : 0)}</b></div>
      </div>
      {personal && <p className="note">Personal expenses, such as founder withdrawals, are not counted in profit. They reduce “Left in business” on the Overview.</p>}
      <div className="card">
        <h2>{sales_ ? 'Record a sale' : personal ? 'Record a personal expense' : 'Record a business expense'}</h2>
        <datalist id="sg">{suggest.map(s => <option key={s} value={s} />)}</datalist>
        <form style={{ marginTop: 0 }} onSubmit={submit(d => put(kind, { id: uid(), date: d.date, label: d.label, amt: +d.amt, note: d.note, ...(sales_ ? {} : { scope: personal ? 'personal' : 'business' }) }))}>
          <input type="date" name="date" defaultValue={today} required aria-label="Date" />
          <input name="label" list="sg" placeholder={sales_ ? 'Project / client' : personal ? 'What for (e.g. Founder withdrawal)' : 'Category (e.g. Software)'} required />
          <input name="amt" type="number" min="0" step="any" placeholder="Amount" required />
          <input name="note" placeholder="Note" /><button className="btn pri">Add</button>
        </form>
      </div>
      <div className="card">
        <h2>{title} <span className="pill">{list.length}</span></h2>
        {list.slice().sort((a, b) => b.date.localeCompare(a.date)).map(x => <Entry key={x.id} x={x} kind={kind} money={money} put={put} del={del} />)}
        {!list.length && <Empty>{fm ? 'Nothing recorded for this period.' : 'Nothing recorded yet.'}</Empty>}
      </div>
    </>
  );
}

// One ledger row, with inline editing. For expenses the editor can also move the entry between business and personal.
function Entry({ x, kind, money, put, del }) {
  const [ed, setEd] = useState(false);
  if (ed) {
    return (
      <form className="eform" onSubmit={e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget));
        put(kind, { ...x, date: d.date, label: d.label, amt: +d.amt, note: d.note, ...(kind === 'expense' ? { scope: d.scope } : {}) });
        setEd(false);
      }}>
        <input type="date" name="date" defaultValue={x.date} required aria-label="Date" />
        <input name="label" defaultValue={x.label} required aria-label="Label" />
        <input name="amt" type="number" min="0" step="any" defaultValue={x.amt} required aria-label="Amount" />
        <input name="note" defaultValue={x.note || ''} placeholder="Note" aria-label="Note" />
        {kind === 'expense' && (
          <select name="scope" defaultValue={x.scope === 'personal' ? 'personal' : 'business'} aria-label="Type">
            <option value="business">Business expense</option><option value="personal">Personal expense</option>
          </select>
        )}
        <button className="btn pri sm">Save</button><button type="button" className="btn sm" onClick={() => setEd(false)}>Cancel</button>
      </form>
    );
  }
  return (
    <div className="row">
      <div className="g"><b>{x.label}</b><span className="mut">{x.date}{x.note ? ' · ' + x.note : ''}</span></div>
      <span className="amt">{money(x.amt)}</span>
      <button className="x txt" onClick={() => setEd(true)} aria-label="Edit entry">Edit</button>
      <button className="x" onClick={() => { if (confirm('Delete this entry?')) del(x.id); }} aria-label="Delete entry">×</button>
    </div>
  );
}

// Sales for the last six months: one series, zero baseline, exact figure on hover or focus.
function SalesChart({ sales, money }) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + k, 1), key = ymd(d).slice(0, 7);
    return { key, label: d.toLocaleDateString(undefined, { month: 'short' }), full: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), v: sum(sales.filter(s => s.date.startsWith(key))) };
  });
  const max = Math.max(...months.map(m => m.v));
  return (
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
  );
}
