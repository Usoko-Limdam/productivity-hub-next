import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeBudgetMonth } from '../lib/budget.mjs';

const budget = {
  month: '2026-11',
  total: 200_000,
  categories: [{ id: 'marketing', name: 'Marketing & Advertising', amount: 100_000 }],
};
const expense = (id, amt, category, date = '2026-11-05', scope = 'business') => ({ id, amt, category, date, scope });

test('multiple expenses add to the allocated category and update remaining/utilization', () => {
  const { actual, categories } = summarizeBudgetMonth(budget, [
    expense('a', 30_000, 'Marketing & Advertising'),
    expense('b', 20_000, 'marketing & advertising'),
  ], '2026-11');
  assert.equal(actual, 50_000);
  assert.equal(categories[0].spent, 50_000);
  assert.equal(categories[0].remaining, 50_000);
  assert.equal(categories[0].utilization, 50);
});

test('expenses without an allocation remain visible as unbudgeted categories', () => {
  const result = summarizeBudgetMonth(budget, [
    expense('a', 8_000, 'Utilities'),
    { id: 'b', amt: 2_000, date: '2026-11-05', scope: 'business' },
  ], '2026-11');
  assert.equal(result.actual, 10_000);
  assert.deepEqual(result.unbudgetedCategories, [
    { name: 'Uncategorized', spent: 2_000 },
    { name: 'Utilities', spent: 8_000 },
  ]);
});

test('editing amount, category, date, or deleting a transaction recalculates from current records', () => {
  const initial = [expense('a', 10_000, 'Marketing & Advertising')];
  assert.equal(summarizeBudgetMonth(budget, initial, '2026-11').categories[0].spent, 10_000);
  assert.equal(summarizeBudgetMonth(budget, [expense('a', 25_000, 'Marketing & Advertising')], '2026-11').categories[0].spent, 25_000);
  const movedCategory = summarizeBudgetMonth(budget, [expense('a', 25_000, 'Utilities')], '2026-11');
  assert.equal(movedCategory.categories[0].spent, 0);
  assert.equal(movedCategory.unbudgeted, 25_000);
  assert.equal(summarizeBudgetMonth(budget, [expense('a', 25_000, 'Marketing & Advertising', '2026-12-01')], '2026-11').actual, 0);
  assert.equal(summarizeBudgetMonth(budget, [], '2026-11').actual, 0);
});

test('month and workspace inputs are isolated, and founder draws are excluded', () => {
  const ascendVistaExpenses = [
    expense('nov', 15_000, 'Marketing & Advertising'),
    expense('oct', 90_000, 'Marketing & Advertising', '2026-10-31'),
    expense('draw', 50_000, 'Marketing & Advertising', '2026-11-05', 'personal'),
  ];
  const bravestoneExpenses = [expense('other-workspace', 70_000, 'Marketing & Advertising')];
  assert.equal(summarizeBudgetMonth(budget, ascendVistaExpenses, '2026-11').actual, 15_000);
  assert.equal(summarizeBudgetMonth(budget, bravestoneExpenses, '2026-11').actual, 70_000);
  assert.equal(summarizeBudgetMonth(budget, ascendVistaExpenses, '2026-10').actual, 90_000);
});
