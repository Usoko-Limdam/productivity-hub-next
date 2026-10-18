'use client';
import { useState } from 'react';
import { Empty, Hub, Icon, Seg, submit, sum, uid, ymd } from './ui';

const VIEWS = ['transactions', 'sales', 'business', 'personal'];
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const displayDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const inclusiveDays = (from, to) => {
  const parts = value => value.split('-').map(Number);
  const [fy, fm, fd] = parts(from), [ty, tm, td] = parts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 864e5) + 1;
};

export default function Money({ of, put, del, money, sub, go }) {
  const today = ymd(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [appliedRange, setAppliedRange] = useState({ from: monthStart, to: today });
  const [rangeError, setRangeError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState('sale');
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
  const presetRange = (from, to = today) => {
    setFromDate(from); setToDate(to); setAppliedRange({ from, to }); setRangeError('');
  };
  const moveToPreviousMonths = count => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (count - 1));
    presetRange(ymd(date).slice(0, 7) + '-01');
  };
  const transactionList = [
    ...sales.map(x => ({ ...x, _kind: 'sale' })),
    ...exps.map(x => ({ ...x, _kind: 'expense' })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const addTransaction = kind => submit(d => {
    const personal = kind === 'personal';
    put(kind === 'sale' ? 'sale' : 'expense', {
      id: uid(), date: d.date, label: d.label, amt: +d.amt, note: d.note,
      ...(kind === 'sale' ? {} : { scope: personal ? 'personal' : 'business' }),
    });
    setShowAdd(false);
  });

  const period = (
    <div className="money-range-wrap">
      <div className="money-range" aria-label="Filter by date range">
        <label>From <span className="money-date-field"><Icon n="cal" /><input type="date" value={fromDate} onChange={e => { const value = e.target.value; setFromDate(value); setRangeError(value && toDate && value > toDate ? 'From date must be on or before the To date.' : ''); }} aria-label="From date" /></span></label>
        <span className="money-range-arrow" aria-hidden="true">→</span>
        <label>To <span className="money-date-field"><Icon n="cal" /><input type="date" value={toDate} onChange={e => { const value = e.target.value; setToDate(value); setRangeError(fromDate && value && fromDate > value ? 'From date must be on or before the To date.' : ''); }} aria-label="To date" /></span></label>
        <div className="money-presets" aria-label="Common date ranges">
          <button className="btn sm" onClick={() => presetRange(monthStart)} aria-pressed={appliedRange?.from === monthStart && appliedRange?.to === today}>This month</button>
          <button className="btn sm" onClick={() => moveToPreviousMonths(3)}>Last 3 months</button>
          <button className="btn sm" onClick={() => moveToPreviousMonths(6)}>Last 6 months</button>
          <button className="btn sm" onClick={() => presetRange(`${today.slice(0, 4)}-01-01`)}>This year</button>
        </div>
        <button className="btn pri sm" onClick={applyRange}>Apply</button>
        <button className="btn sm" onClick={showAllTime} aria-pressed={!appliedRange}>All time</button>
      </div>
      {rangeError && <p className="money-range-error" role="alert">{rangeError}</p>}
      {!appliedRange && !rangeError && <p className="money-range-status">Showing all time. Choose dates and click Apply to filter.</p>}
      {appliedRange && <p className="money-range-status">Showing {displayDate(appliedRange.from)} to {displayDate(appliedRange.to)} ({inclusiveDays(appliedRange.from, appliedRange.to)} days)</p>}
    </div>
  );

  const transactionToolbar = (
    <div className="money-toolbar">
      <button className="btn pri" onClick={() => setShowAdd(open => !open)} aria-expanded={showAdd}>＋ Add transaction</button>
      {showAdd && <div className="card money-quick-add">
        <div className="top"><h2 style={{ margin: 0 }}>Add transaction</h2><button className="btn sm" onClick={() => setShowAdd(false)}>Cancel</button></div>
        <form className="money-add-form" onSubmit={addTransaction(addType)}>
          <select value={addType} onChange={e => setAddType(e.target.value)} aria-label="Transaction type">
            <option value="sale">Sale</option><option value="business">Business expense</option><option value="personal">Founder draw</option>
          </select>
          <input type="date" name="date" defaultValue={today} required aria-label="Date" />
          <input name="label" placeholder={addType === 'sale' ? 'Project / client' : addType === 'personal' ? 'What for (e.g. Founder draw)' : 'Category (e.g. Software)'} required aria-label="Description" />
          <input name="amt" type="number" min="0" step="any" placeholder="Amount" required aria-label="Amount" />
          <input name="note" placeholder="Note (optional)" aria-label="Note" />
          <button className="btn pri">Save transaction</button>
        </form>
      </div>}
    </div>
  );

  if (view === 'hub') {
    const founderDraws = sum(per);
    return (
      <>
        {transactionToolbar}
        {period}
        <div className="hubs money-summary">
          <Hub title="Sales" big={money(sum(sales))} note={plural(sales.length, 'entry', 'entries')} onClick={() => goto('sales')} />
          <Hub title="Business expenses" big={money(sum(biz))} note={plural(biz.length, 'entry', 'entries')} onClick={() => goto('business')} />
          <Hub title="Founder draws" big={money(founderDraws)} note={`${plural(per.length, 'entry', 'entries')} · included in profit`} onClick={() => goto('personal')} />
          <div className="hub money-profit"><span className="hl">Profit after expenses</span><b className={profit < 0 ? 'neg' : ''}>{money(profit)}</b><small>After business expenses and founder draws</small></div>
        </div>
        <SalesChart sales={sales} money={money} range={appliedRange} />
        <RecentTransactions items={transactionList.slice(0, 6)} money={money} go={goto} />
      </>
    );
  }

  const transactions = view === 'transactions';
  const sales_ = view === 'sales', personal = view === 'personal';
  const list = transactions ? transactionList : sales_ ? sales : personal ? per : biz;
  const title = transactions ? 'Transactions' : sales_ ? 'Sales' : personal ? 'Founder draws' : 'Business expenses';
  const kind = sales_ ? 'sale' : 'expense';
  const suggest = sales_ ? of('project').map(q => q.name) : [...new Set(of('expense').filter(x => (x.scope === 'personal') === personal).map(x => x.label))];
  const total = sum(list);

  return (
    <>
      {transactionToolbar}
      <Seg value={view} onChange={goto} items={[{ id: 'hub', label: 'Overview' }, { id: 'transactions', label: 'Transactions' }, { id: 'sales', label: 'Sales' }, { id: 'business', label: 'Business expenses' }, { id: 'personal', label: 'Founder draws' }]} />
      {period}
      <div className="stats">
        <div className="stat"><span>{transactions ? 'Transaction value' : 'Total'}</span><b className={sales_ ? 'pos' : ''}>{money(total)}</b></div>
        <div className="stat"><span>Entries</span><b>{list.length}</b></div>
        <div className="stat"><span>{transactions ? 'Average per transaction' : 'Average'}</span><b>{money(list.length ? total / list.length : 0)}</b></div>
      </div>
      {personal && <p className="note">Founder draws are recorded as personal expenses and reduce profit after expenses.</p>}
      {!transactions && <div className="card">
        <h2>{sales_ ? 'Record a sale' : personal ? 'Record a founder draw' : 'Record a business expense'}</h2>
        <datalist id="sg">{suggest.map(s => <option key={s} value={s} />)}</datalist>
        <form style={{ marginTop: 0 }} onSubmit={submit(d => put(kind, { id: uid(), date: d.date, label: d.label, amt: +d.amt, note: d.note, ...(sales_ ? {} : { scope: personal ? 'personal' : 'business' }) }))}>
          <input type="date" name="date" defaultValue={today} required aria-label="Date" />
          <input name="label" list="sg" placeholder={sales_ ? 'Project / client' : personal ? 'What for (e.g. Founder withdrawal)' : 'Category (e.g. Software)'} required />
          <input name="amt" type="number" min="0" step="any" placeholder="Amount" required />
          <input name="note" placeholder="Note" /><button className="btn pri">Add</button>
        </form>
      </div>}
      <div className="card">
        <h2>{title} <span className="pill">{list.length}</span></h2>
        {list.slice().sort((a, b) => b.date.localeCompare(a.date)).map(x => <Entry key={x.id} x={x} kind={transactions ? x._kind : kind} money={money} put={put} del={del} />)}
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
        const record = { ...x };
        delete record._kind;
        put(kind, { ...record, date: d.date, label: d.label, amt: +d.amt, note: d.note, ...(kind === 'expense' ? { scope: d.scope } : {}) });
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

function RecentTransactions({ items, money, go }) {
  return (
    <div className="card recent-transactions">
      <div className="top"><h2 style={{ margin: 0 }}>Recent transactions</h2><button className="btn sm" onClick={() => go('transactions')}>View all ›</button></div>
      {items.length > 0 ? <>
        <div className="transaction-head" aria-hidden="true"><span>Date</span><span>Description</span><span>Category</span><span>Amount</span><span>Type</span></div>
        {items.map(x => {
          const sale = x._kind === 'sale';
          const category = sale ? 'Sales' : x.scope === 'personal' ? 'Founder draws' : 'Business expenses';
          return <div className={'transaction-row ' + (sale ? 'income' : x.scope === 'personal' ? 'draw' : 'expense')} key={`${x._kind}-${x.id}`}>
            <span className="transaction-date">{displayDate(x.date)}</span>
            <span className="transaction-description"><b>{x.label}</b>{x.note && <small>{x.note}</small>}</span>
            <span className="transaction-category">{category}</span>
            <b className={'transaction-amount' + (sale ? ' pos' : '')}>{money(x.amt)}</b>
            <span className={'transaction-type ' + (sale ? 'income' : x.scope === 'personal' ? 'draw' : 'expense')}>{sale ? 'Income' : x.scope === 'personal' ? 'Draw' : 'Expense'}</span>
          </div>;
        })}
      </> : <Empty>No transactions recorded in this date range.</Empty>}
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
  const magnitude = max > 0 ? 10 ** Math.floor(Math.log10(max)) : 1;
  const chartMax = max > 0 ? Math.ceil(max * 1.12 / (magnitude / 10)) * (magnitude / 10) : 0;
  const compactMoney = value => value >= 1e9 ? `${money(value / 1e9)}b` : value >= 1e6 ? `${money(value / 1e6)}m` : money(value);
  const lastPositive = months.reduce((found, month, index) => month.v > 0 ? index : found, -1);
  return (
    <div className="card">
      <div className="top"><h2 style={{ margin: 0 }}>Sales by month</h2><span className="pill">Monthly</span></div>
      {max > 0 ? (
        <>
          <div className="chart-layout">
            <div className="chart-y-axis" aria-hidden="true"><span>{compactMoney(chartMax)}</span><span>{compactMoney(chartMax / 2)}</span><span>{money(0)}</span></div>
            <div className="chart-scroll"><div className="chart-inner" style={{ minWidth: `${Math.max(100, months.length * 48)}px` }}>
            <div className="bars" role="group" aria-label="Monthly sales in the selected date range" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(32px, 1fr))` }}>
              {months.map((m, k) => {
                const h = m.v / chartMax * 100;
                return (
                  <div className="bcol" key={m.key} tabIndex={0} style={{ '--h': h + '%' }}>
                    <i style={{ height: h + '%' }} />
                    {k === lastPositive && <b className="bv">{compactMoney(m.v)}</b>}
                    <span className="tip">{m.full}: {money(m.v)}</span>
                  </div>
                );
              })}
            </div>
            <div className="bx" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(32px, 1fr))` }}>{months.map(m => <span key={m.key}>{m.label}</span>)}</div>
            </div></div>
          </div>
          <table className="sr"><caption>Sales by month</caption><tbody>{months.map(m => <tr key={m.key}><th scope="row">{m.full}</th><td>{money(m.v)}</td></tr>)}</tbody></table>
        </>
      ) : <Empty>{range ? 'No sales recorded in this date range.' : 'No sales recorded yet.'}</Empty>}
    </div>
  );
}
