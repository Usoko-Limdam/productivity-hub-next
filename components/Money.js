'use client';
import { useState } from 'react';
import { Empty, Hub, Icon, Seg, submit, sum, uid, ymd } from './ui';
import { expenseCategory, summarizeBudgetMonth } from '../lib/budget.mjs';

const VIEWS = ['transactions', 'sales', 'business', 'personal'];
const DEFAULT_EXPENSE_CATEGORIES = ['Marketing & Advertising', 'Salaries & Contractors', 'Software & Subscriptions', 'Operations', 'Office & Administration', 'Utilities', 'Transportation', 'Professional Services', 'Miscellaneous'];
const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
const displayDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const inclusiveDays = (from, to) => {
  const parts = value => value.split('-').map(Number);
  const [fy, fm, fd] = parts(from), [ty, tm, td] = parts(to);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 864e5) + 1;
};

export default function Money({ of, put, del, money, sub, go, workspace }) {
  const today = ymd(new Date());
  const monthStart = `${today.slice(0, 7)}-01`;
  const allExpenses = of('expense');
  const budgets = of('budget').slice().sort((a, b) => a.month.localeCompare(b.month));
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [appliedRange, setAppliedRange] = useState({ from: monthStart, to: today });
  const [rangeError, setRangeError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState('sale');
  const [budgetMonth, setBudgetMonth] = useState(today.slice(0, 7));
  const [budgetModal, setBudgetModal] = useState(false);
  const [budgetMessage, setBudgetMessage] = useState('');
  const view = VIEWS.includes(sub) ? sub : 'hub';
  const goto = id => go('money', id === 'hub' ? null : id);

  // Ledger dates are stored as local calendar dates (YYYY-MM-DD), not timestamps.
  // Comparing those normalized strings includes both boundary days without timezone shifts.
  const inPeriod = a => a.filter(x => !appliedRange || (x.date >= appliedRange.from && x.date <= appliedRange.to));
  const sales = inPeriod(of('sale')), exps = inPeriod(of('expense'));
  // Personal-scope expenses are founder draws and reduce the business profit shown here.
  const biz = exps.filter(x => x.scope !== 'personal'), per = exps.filter(x => x.scope === 'personal');
  const profit = sum(sales) - sum(biz) - sum(per);
  const activeBudget = budgets.find(budget => budget.month === budgetMonth);
  const budgetSummary = summarizeBudgetMonth(activeBudget, allExpenses, budgetMonth);
  const actualSpending = budgetSummary.actual;
  const monthlyBudgetTotal = Number(activeBudget?.total || 0);
  const budgetRemaining = activeBudget ? monthlyBudgetTotal - actualSpending : 0;
  const utilization = monthlyBudgetTotal ? actualSpending / monthlyBudgetTotal * 100 : 0;
  const budgetCategoryStats = budgetSummary.categories;
  const unbudgetedCategories = budgetSummary.unbudgetedCategories;
  const uncategorizedSpending = budgetSummary.unbudgeted;
  const allocatedTotal = (activeBudget?.categories || []).reduce((total, category) => total + Number(category.amount || 0), 0);
  const unallocatedTotal = monthlyBudgetTotal - allocatedTotal;
  const expenseCategorySuggestions = [...new Set([...budgets.flatMap(budget => (budget.categories || []).map(category => category.name.trim())), ...allExpenses.filter(expense => expense.scope !== 'personal').map(expenseCategory), ...DEFAULT_EXPENSE_CATEGORIES].filter(Boolean))].sort((a, b) => a.localeCompare(b));

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
      ...(kind === 'sale' ? {} : { scope: personal ? 'personal' : 'business', ...(personal ? {} : { category: d.category.trim() }) }),
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
          <input name="label" placeholder={addType === 'sale' ? 'Project / client' : addType === 'personal' ? 'What for (e.g. Founder draw)' : 'Expense description (e.g. Facebook Ads)'} required aria-label={addType === 'business' ? 'Expense description' : 'Description'} />
          {addType === 'business' && <label className="money-expense-category">Expense category<input name="category" list="money-expense-category-options" placeholder="Select or type a category" required aria-label="Expense category" /><datalist id="money-expense-category-options">{expenseCategorySuggestions.map(category => <option value={category} key={category} />)}</datalist></label>}
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
        <BudgetDashboard budget={activeBudget} budgets={budgets} month={budgetMonth} setMonth={setBudgetMonth} actual={actualSpending} total={monthlyBudgetTotal} remaining={budgetRemaining} utilization={utilization} categories={budgetCategoryStats} uncategorized={uncategorizedSpending} unbudgetedCategories={unbudgetedCategories} allocated={allocatedTotal} unallocated={unallocatedTotal} expenses={allExpenses} money={money} suggestions={expenseCategorySuggestions} message={budgetMessage} onCreate={() => { setBudgetMessage(''); setBudgetModal(true); }} onEdit={() => { setBudgetMessage(''); setBudgetModal(true); }} onSaveBudget={async data => {
          const id = `budget:${workspace?.id}:${data.month}`;
          const result = await put('budget', { ...data, id }, true);
          setBudgetMessage(result.ok ? 'Budget saved.' : result.error);
          return result;
        }} onRemoveCategory={categoryId => {
          if (!activeBudget) return;
          put('budget', { ...activeBudget, categories: activeBudget.categories.filter(category => category.id !== categoryId) });
          setBudgetMessage('Category allocation removed. Related expenses remain in your transaction history.');
        }} />
        {budgetModal && <BudgetModal key={activeBudget?.id || budgetMonth} budget={activeBudget} month={budgetMonth} suggestions={expenseCategorySuggestions} money={money} onClose={() => setBudgetModal(false)} onSave={async data => {
          const result = await put('budget', { ...data, id: activeBudget?.id || `budget:${workspace?.id}:${data.month}` }, true);
          setBudgetMessage(result.ok ? 'Budget saved.' : result.error);
          if (result.ok) setBudgetModal(false);
          return result;
        }} />}
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
        <form className={!sales_ && !personal ? 'money-record-form' : ''} style={{ marginTop: 0 }} onSubmit={submit(d => put(kind, { id: uid(), date: d.date, label: d.label, amt: +d.amt, note: d.note, ...(sales_ ? {} : { scope: personal ? 'personal' : 'business', ...(personal ? {} : { category: d.category.trim() }) }) }))}>
          <input type="date" name="date" defaultValue={today} required aria-label="Date" />
          <input name="label" list={sales_ ? 'sg' : undefined} placeholder={sales_ ? 'Project / client' : personal ? 'What for (e.g. Founder withdrawal)' : 'Expense description (e.g. Facebook Ads)'} required aria-label={sales_ ? 'Sale description' : personal ? 'Founder draw description' : 'Expense description'} />
          {!sales_ && !personal && <label className="money-expense-category">Expense category<input name="category" list="money-expense-category-options-ledger" placeholder="Select or type a category" required aria-label="Expense category" /><datalist id="money-expense-category-options-ledger">{expenseCategorySuggestions.map(category => <option value={category} key={category} />)}</datalist></label>}
          <input name="amt" type="number" min="0" step="any" placeholder="Amount" required />
          <input name="note" placeholder="Note" /><button className="btn pri">Add</button>
        </form>
      </div>}
      <div className="card">
        <h2>{title} <span className="pill">{list.length}</span></h2>
        {list.slice().sort((a, b) => b.date.localeCompare(a.date)).map(x => <Entry key={x.id} x={x} kind={transactions ? x._kind : kind} money={money} put={put} del={del} transactions={transactions} categorySuggestions={expenseCategorySuggestions} />)}
        {!list.length && <Empty>{appliedRange ? 'Nothing recorded in this date range.' : 'Nothing recorded yet.'}</Empty>}
      </div>
    </>
  );
}

// One ledger row, with inline editing. For expenses the editor can also move the entry between business and personal.
function Entry({ x, kind, money, put, del, transactions = false, categorySuggestions = [] }) {
  const [ed, setEd] = useState(false);
  const [editScope, setEditScope] = useState(x.scope === 'personal' ? 'personal' : 'business');
  const sale = kind === 'sale';
  const personal = x.scope === 'personal';
  const category = sale ? 'Sales' : personal ? 'Founder draws' : expenseCategory(x);
  const type = sale ? 'income' : personal ? 'draw' : 'expense';
  if (ed) {
    return (
      <form className="eform" onSubmit={e => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget));
        const record = { ...x };
        delete record._kind;
        put(kind, { ...record, date: d.date, label: d.label, amt: +d.amt, note: d.note, ...(kind === 'expense' ? { scope: d.scope, category: d.scope === 'business' ? d.category.trim() : '' } : {}) });
        setEd(false);
      }}>
        <input type="date" name="date" defaultValue={x.date} required aria-label="Date" />
        <input name="label" defaultValue={x.label} required aria-label="Label" />
        <input name="amt" type="number" min="0" step="any" defaultValue={x.amt} required aria-label="Amount" />
        <input name="note" defaultValue={x.note || ''} placeholder="Note" aria-label="Note" />
        {kind === 'expense' && (
          <select name="scope" value={editScope} onChange={event => setEditScope(event.target.value)} aria-label="Type">
            <option value="business">Business expense</option><option value="personal">Personal expense</option>
          </select>
        )}
        {kind === 'expense' && editScope === 'business' && <input name="category" list={`expense-categories-${x.id}`} defaultValue={x.category || x.label || ''} placeholder="Expense category" required aria-label="Expense category" />}
        {kind === 'expense' && editScope === 'business' && <datalist id={`expense-categories-${x.id}`}>{categorySuggestions.map(value => <option value={value} key={value} />)}</datalist>}
        <button className="btn pri sm">Save</button><button type="button" className="btn sm" onClick={() => setEd(false)}>Cancel</button>
      </form>
    );
  }
  if (transactions) {
    return (
      <div className={`transaction-row managed ${type}`}>
        <span className="transaction-date">{displayDate(x.date)}</span>
        <span className="transaction-description"><b>{x.label}</b>{x.note && <small>{x.note}</small>}</span>
        <span className="transaction-category">{category}</span>
        <b className={'transaction-amount' + (sale ? ' pos' : '')}>{money(x.amt)}</b>
        <span className={'transaction-type ' + type}>{sale ? 'Income' : personal ? 'Draw' : 'Expense'}</span>
        <span className="transaction-actions">
          <button className="x txt" onClick={() => setEd(true)} aria-label="Edit entry">Edit</button>
          <button className="x" onClick={() => { if (confirm('Delete this entry?')) del(x.id); }} aria-label="Delete entry">×</button>
        </span>
      </div>
    );
  }
  return (
    <div className="row">
      <div className="g"><b>{x.label}</b><span className="mut">{x.date}{kind === 'expense' && !personal ? ` · ${expenseCategory(x)}` : ''}{x.note ? ' · ' + x.note : ''}</span></div>
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
          const category = sale ? 'Sales' : x.scope === 'personal' ? 'Founder draws' : expenseCategory(x);
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

function BudgetDashboard({ budget, budgets, month, setMonth, actual, total, remaining, utilization, categories, uncategorized, unbudgetedCategories, allocated, unallocated, expenses, money, suggestions, message, onCreate, onEdit, onRemoveCategory }) {
  const history = budgets.slice(-6).map(item => ({
    ...item,
    actual: sum(expenses.filter(expense => expense.scope !== 'personal' && expense.date?.startsWith(item.month))),
    label: new Date(`${item.month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
  }));
  const max = Math.max(1, ...history.flatMap(item => [Number(item.total) || 0, item.actual]));
  const status = value => value >= 100 ? 'exceeded' : value >= 80 ? 'warning' : 'normal';
  const cap = value => Math.max(0, Math.min(100, value));
  const monthLabel = month ? new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '';
  return <section className="budget-dashboard" aria-label="Monthly budget management">
    <div className="budget-kpis">
      <div className="budget-kpi"><span>Total budget</span><b>{money(total)}</b><small>{monthLabel}</small></div>
      <div className="budget-kpi"><span>Actual spending</span><b>{money(actual)}</b><small>Business expenses only</small></div>
      <div className={'budget-kpi ' + (remaining < 0 ? 'is-over' : '')}><span>Budget remaining</span><b>{money(remaining)}</b><small>{remaining < 0 ? `${money(Math.abs(remaining))} over budget` : 'Available to spend'}</small></div>
      <div className="budget-kpi"><span>Budget utilization</span><b>{total ? `${utilization.toFixed(1)}%` : '—'}</b><small>{total ? 'Actual spending ÷ total budget' : 'Create a budget to track utilization'}</small></div>
    </div>

    <section className="card budget-monthly">
      <header className="budget-heading"><div><h2>Monthly budget</h2><p>Plan spending and track actual business expenses.</p></div><div className="budget-controls"><label className="sr" htmlFor="budget-month">Budget month</label><input id="budget-month" type="month" value={month} onChange={event => setMonth(event.target.value)} /><button className="btn pri" onClick={budget ? onEdit : onCreate}>{budget ? 'Edit budget' : '＋ Create budget'}</button></div></header>
      {budget ? <>
        <div className="budget-progress-summary"><div><b>{total ? `${utilization.toFixed(1)}%` : '—'}</b><span>Budget utilization</span></div><div className="budget-progress-main"><div className="budget-track"><i className={status(utilization)} style={{ width: `${cap(utilization)}%` }} /></div><small>{money(allocated)} allocated to categories · {money(Math.max(0, unallocated))} unallocated</small></div><div><b>{money(actual)}</b><span>Spent</span></div><div><b className={remaining < 0 ? 'neg' : ''}>{money(remaining)}</b><span>{remaining < 0 ? 'Overspent' : 'Remaining'}</span></div></div>
        {utilization >= 100 ? <p className="budget-alert exceeded">Budget exceeded by {money(Math.max(0, actual - total))}.</p> : utilization >= 80 ? <p className="budget-alert warning">You have used {utilization.toFixed(1)}% of this month’s budget.</p> : null}
        <div className="budget-table-wrap"><table className="budget-table"><thead><tr><th>Category</th><th>Allocated</th><th>Spent</th><th>Remaining</th><th>Progress</th><th><span className="sr">Actions</span></th></tr></thead><tbody>
          {categories.map(category => <tr key={category.id}><td><span className="budget-category-icon">{category.name.slice(0,1).toUpperCase()}</span>{category.name}</td><td>{money(category.amount)}</td><td>{money(category.spent)}</td><td className={category.remaining < 0 ? 'neg' : ''}>{money(category.remaining)}</td><td><div className="budget-category-progress"><div className="budget-track"><i className={status(category.utilization)} style={{ width: `${cap(category.utilization)}%` }} /></div><b>{category.utilization.toFixed(0)}%</b></div>{category.utilization >= 100 && <small className="budget-row-alert">Exceeded by {money(category.spent - Number(category.amount))}</small>}{category.utilization >= 80 && category.utilization < 100 && <small className="budget-row-alert warning-text">Near limit</small>}</td><td className="budget-row-actions"><button className="x txt" onClick={onEdit}>Edit</button><button className="x txt" onClick={() => onRemoveCategory(category.id)} aria-label={`Remove ${category.name} allocation`}>Remove</button></td></tr>)}
          {unbudgetedCategories.map(item => <tr className="budget-uncategorized" key={item.name}><td><span className="budget-category-icon">?</span>{item.name === 'Uncategorized' ? 'Uncategorized spending' : item.name}</td><td>Unbudgeted</td><td>{money(item.spent)}</td><td>—</td><td>Spending has no allocation yet.</td><td className="budget-row-actions"><button className="x txt" onClick={onEdit}>Allocate</button></td></tr>)}
        </tbody></table></div>
        {!categories.length && !uncategorized && <p className="budget-empty-inline">No categories yet. Edit this budget to add category allocations.</p>}
        {unallocated > 0 && <p className="budget-unallocated">{money(unallocated)} of this budget has not been assigned to a category yet.</p>}
      </> : <div className="budget-empty"><span className="budget-empty-icon">◷</span><div><b>No budget for {monthLabel}</b><p>Create a monthly budget to compare planned amounts with recorded business expenses. Existing expenses will be counted automatically.</p></div><button className="btn pri" onClick={onCreate}>Create budget</button></div>}
      {!budget && unbudgetedCategories.length > 0 && <div className="budget-unbudgeted-list"><b>Business spending in {monthLabel}</b>{unbudgetedCategories.map(item => <div key={item.name}><span>{item.name}</span><strong>{money(item.spent)}</strong></div>)}<small>These expenses are counted in actual spending and can be assigned to budget categories when you create a budget.</small></div>}
      {message && <p className="budget-message" role="status">{message}</p>}
    </section>

    <div className="budget-lower-grid">
      <section className="card budget-history"><div className="budget-heading"><div><h2>Budget vs actual</h2><p>Monthly totals across saved budgets.</p></div><div className="budget-legend"><span><i /> Budget</span><span><i /> Actual</span></div></div>
        {history.length ? <div className="budget-chart" role="img" aria-label="Budget versus actual spending by month">{history.map(item => <div className="budget-chart-month" key={item.id}><div className="budget-chart-bars"><i className="planned" style={{ height: `${Math.max(3, Number(item.total) / max * 100)}%` }} title={`Budget ${money(item.total)}`} /><i className="actual" style={{ height: `${Math.max(item.actual ? 3 : 0, item.actual / max * 100)}%` }} title={`Actual ${money(item.actual)}`} /></div><small>{item.label}</small></div>)}</div> : <div className="budget-chart-empty">Create budgets for multiple months to see a historical comparison.</div>}
      </section>
      <section className="card budget-insights"><h2>Expense tracking</h2><p>Actuals are calculated from business expense transactions dated in {monthLabel}. Sales and founder draws are excluded.</p><p>Expense category names link transactions to the matching allocation. Transactions in categories without an allocation remain visible as unbudgeted spending.</p>{uncategorized > 0 && <p className="budget-alert warning">Unbudgeted spending: {money(uncategorized)}</p>}<span className="budget-suggestion-note">Expense categories: {suggestions.length ? suggestions.slice(0, 5).join(' · ') : 'No expense categories yet'}</span></section>
    </div>
  </section>;
}

function BudgetModal({ budget, month, suggestions, money, onClose, onSave }) {
  const [name, setName] = useState(budget?.name || 'Monthly operating budget');
  const [total, setTotal] = useState(budget?.total ?? '');
  const [categories, setCategories] = useState(() => (budget?.categories || []).map(item => ({ ...item, amount: String(item.amount) })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const allocated = categories.reduce((sum_, item) => sum_ + Number(item.amount || 0), 0);
  const balance = Number(total || 0) - allocated;
  const update = (id, field, value) => setCategories(rows => rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  const addCategory = () => setCategories(rows => [...rows, { id: uid(), name: '', amount: '' }]);
  const save = async event => {
    event.preventDefault();
    const cleanCategories = categories.map(category => ({ id: category.id || uid(), name: category.name.trim(), amount: Number(category.amount) }));
    if (!name.trim()) { setError('Enter a budget name.'); return; }
    if (!Number.isFinite(Number(total)) || Number(total) <= 0) { setError('Enter a total budget greater than zero.'); return; }
    if (cleanCategories.some(category => !category.name || !Number.isFinite(category.amount) || category.amount < 0)) { setError('Each category needs a name and a valid allocation.'); return; }
    if (new Set(cleanCategories.map(category => category.name.toLocaleLowerCase())).size !== cleanCategories.length) { setError('Category names must be unique.'); return; }
    if (cleanCategories.reduce((sum_, category) => sum_ + category.amount, 0) > Number(total) + 0.000001) { setError('Category allocations cannot exceed the total budget.'); return; }
    setSaving(true); setError('');
    try {
      const result = await onSave({ name: name.trim(), month, total: Number(total), categories: cleanCategories });
      if (!result?.ok) setError(result?.error || 'The budget could not be saved.');
    } catch { setError('The budget could not be saved. Check your connection and try again.'); }
    finally { setSaving(false); }
  };
  return <div className="budget-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="budget-modal" role="dialog" aria-modal="true" aria-labelledby="budget-modal-title"><header className="budget-heading"><div><h2 id="budget-modal-title">{budget ? 'Edit monthly budget' : 'Create monthly budget'}</h2><p>{budget ? `Update your ${month} budget and allocations.` : `Set a plan for ${month}.`}</p></div><button type="button" className="x" onClick={onClose} aria-label="Close">×</button></header>
    <form onSubmit={save}><label className="budget-field">Budget name<input value={name} maxLength={100} onChange={event => setName(event.target.value)} required /></label><div className="budget-form-row"><label className="budget-field">Month<input type="month" value={month} disabled aria-describedby="budget-month-help" /></label><label className="budget-field">Total budget<input type="number" min="0.01" step="0.01" value={total} onChange={event => setTotal(event.target.value)} required /></label></div><small id="budget-month-help" className="budget-muted">A workspace can have one budget per month.</small>
      <div className="budget-category-heading"><b>Category allocations</b><button type="button" className="btn sm" onClick={addCategory}>＋ Add category</button></div><datalist id="budget-category-options">{suggestions.map(item => <option key={item} value={item} />)}</datalist><div className="budget-category-fields">{categories.map(category => <div className="budget-category-field-row" key={category.id}><input aria-label="Category name" list="budget-category-options" placeholder="Category name" value={category.name} onChange={event => update(category.id, 'name', event.target.value)} /><input aria-label="Allocated amount" type="number" min="0" step="0.01" placeholder="Amount" value={category.amount} onChange={event => update(category.id, 'amount', event.target.value)} /><button type="button" className="x" aria-label={`Remove ${category.name || 'category'}`} onClick={() => setCategories(rows => rows.filter(row => row.id !== category.id))}>×</button></div>)}{!categories.length && <p className="budget-empty-inline">No categories added. You can add categories now or later.</p>}</div>
      <p className={'budget-allocation-balance' + (balance < -0.000001 ? ' neg' : '')}>{balance >= 0 ? `${money(balance)} unallocated` : 'Category allocations exceed the total budget.'}</p>{error && <p className="budget-form-error" role="alert">{error}</p>}<footer className="budget-modal-actions"><button className="btn" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="btn pri" type="submit" disabled={saving}>{saving ? 'Saving…' : budget ? 'Save changes' : 'Create budget'}</button></footer>
    </form></section></div>;
}
