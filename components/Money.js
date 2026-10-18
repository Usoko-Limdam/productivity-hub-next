'use client';
import { useState } from 'react';
import { Empty, Hub, Seg, submit, sum, uid, ymd } from './ui';

const VIEWS = ['sales', 'business', 'personal'];
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;

export default function Money({ of, put, del, money, sub, go }) {
  const today = ymd(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [appliedRange, setAppliedRange] = useState({ from: monthStart, to: today });
  const [rangeError, setRangeError] = useState('');
  const view = VIEWS.includes(sub) ? sub : 'hub';
  const goto = id => go('money', id === 'hub' ? null : id);

  // Ledger dates are stored as local calendar dates (YYYY-MM-DD), not timestamps.
  // Comparing those normalized strings includes both boundary days without timezone shifts.
  const inPeriod = a => a.filter(x => !appliedRange || (x.date >= appliedRange.from && x.date <= appliedRange.to));
  const sales = inPeriod(of('sale')), exps = inPeriod(of('expense'));
  // Personal-scope expenses are founder draws and reduce the business profit shown here.
  const biz = exps.filter(x => x.scope !== 'personal'), per = exps.filter(x => x.scope === 'personal');
  const profit = sum(sales) - sum(biz) - sum(per);

  const applyRange = () => {
    if (!fromDate || !toDate) { setRangeError('Choose both a From date and a To date.'); return; }
    if (fromDate > toDate) { setRangeError('From date must be on or before the To date.'); return; }
    setRangeError('');
    setAppliedRange({ from: fromDate, to: toDate });
  };
  const showAllTime = () => {
    setAppliedRange(null);
    setFromDate(''); setToDate(''); setRangeError('');
  };

  const period = (
    <div className="money-range-wrap">
      <div className="money-range" aria-label="Filter by date range">
        <label>From <input type="date" value={fromDate} onChange={e => { const value = e.target.value; setFromDate(value); setRangeError(value && toDate && value > toDate ? 'From date must be on or before the To date.' : ''); }} aria-label="From date" /></label>
        <label>To <input type="date" value={toDate} onChange={e => { const value = e.target.value; setToDate(value); setRangeError(fromDate && value && fromDate > value ? 'From date must be on or before the To date.' : ''); }} aria-label="To date" /></label>
        <button className="btn pri sm" onClick={applyRange}>Apply</button>
        <button className="btn sm" onClick={showAllTime} aria-pressed={!appliedRange}>All time</button>
      </div>
      {rangeError && <p className="money-range-error" role="alert">{rangeError}</p>}
      {!appliedRange && !rangeError && <p className="money-range-status">Showing all time. Choose dates and click Apply to filter.</p>}
      {appliedRange && <p className="money-range-status">Showing {appliedRange.from} to {appliedRange.to}</p>}
    </div>
  );

  if (view === 'hub') {
    return (
      <>
        {period}
        <div className="hubs">
          <Hub title="Sales" big={money(sum(sales))} note={plural(sales.length, 'entry', 'entries')} onClick={() => goto('sales')} />
          <Hub title="Business expenses" big={money(sum(biz))} note={plural(biz.length, 'entry', 'entries')} onClick={() => goto('business')} />
          <Hub title="Founder draws" big={money(sum(per))} note={`${plural(per.length, 'entry', 'entries')} · included in profit`} onClick={() => goto('personal')} />
        </div>
        <div className="stats2">
          <div className="stat"><span>Profit after expenses</span><b className={profit < 0 ? 'neg' : ''}>{money(profit)}</b><small>Sales minus business expenses and founder draws</small></div>
          <div className="stat"><span>Founder draws</span><b>{money(sum(per))}</b><small>Personal expenses for this period</small></div>
        </div>
        <SalesChart sales={sales} money={money} range={appliedRange} />
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
      {personal && <p className="note">Founder draws are recorded as personal expenses and reduce profit after expenses.</p>}
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
        {!list.length && <Empty>{appliedRange ? 'Nothing recorded in this date range.' : 'Nothing recorded yet.'}</Empty>}
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

// Monthly sales buckets use the same already-filtered records as the other Money metrics.
function SalesChart({ sales, money, range }) {
  const dates = sales.map(s => s.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const first = range?.from || dates[0], last = range?.to || dates[dates.length - 1];
  const months = [];
  if (first && last) {
    const start = first.slice(0, 7), end = last.slice(0, 7);
    let cursor = new Date(`${start}-01T00:00:00`);
    const finish = new Date(`${end}-01T00:00:00`);
    while (cursor <= finish && months.length < 600) {
      const key = ymd(cursor).slice(0, 7);
      months.push({ key, label: cursor.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), full: cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), v: sum(sales.filter(s => s.date.startsWith(key))) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }
  const max = Math.max(...months.map(m => m.v));
  return (
    <div className="card">
      <h2>Sales by month</h2>
      {max > 0 ? (
        <>
          <div className="chart-scroll"><div className="chart-inner" style={{ minWidth: `${Math.max(100, months.length * 48)}px` }}>
            <div className="bars" role="group" aria-label="Monthly sales in the selected date range" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(32px, 1fr))` }}>
              {months.map((m, k) => {
                const h = m.v / max * 100;
                return (
                  <div className="bcol" key={m.key} tabIndex={0} style={{ '--h': h + '%' }}>
                    <i style={{ height: h + '%' }} />
                    {k === months.length - 1 && m.v > 0 && <b className="bv">{money(m.v)}</b>}
                    <span className="tip">{m.full}: {money(m.v)}</span>
                  </div>
                );
              })}
            </div>
            <div className="bx" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(32px, 1fr))` }}>{months.map(m => <span key={m.key}>{m.label}</span>)}</div>
          </div></div>
          <table className="sr"><caption>Sales by month</caption><tbody>{months.map(m => <tr key={m.key}><th scope="row">{m.full}</th><td>{money(m.v)}</td></tr>)}</tbody></table>
        </>
      ) : <Empty>{range ? 'No sales recorded in this date range.' : 'No sales recorded yet.'}</Empty>}
    </div>
  );
}
