export const expenseCategory = expense => String(expense.category || expense.label || '').trim() || 'Uncategorized';
const categoryKey = value => String(value || '').trim().toLocaleLowerCase();
const amountOf = expense => Number(expense.amt || 0);

// `expenses` is already scoped to the active workspace by WorkHub's item loader.
// Budget actuals are always derived from the current transaction records.
export function summarizeBudgetMonth(budget, expenses, month) {
  const monthExpenses = expenses.filter(expense => expense.scope !== 'personal'
    && typeof expense.date === 'string' && expense.date.startsWith(month));
  const actual = monthExpenses.reduce((total, expense) => total + amountOf(expense), 0);
  const categories = (budget?.categories || []).map(category => {
    const spent = monthExpenses
      .filter(expense => categoryKey(expenseCategory(expense)) === categoryKey(category.name))
      .reduce((total, expense) => total + amountOf(expense), 0);
    const allocated = Number(category.amount || 0);
    return {
      ...category,
      spent,
      remaining: allocated - spent,
      utilization: allocated ? spent / allocated * 100 : spent ? 100 : 0,
    };
  });
  const allocatedNames = new Set((budget?.categories || []).map(category => categoryKey(category.name)));
  const unbudgetedCategories = Object.values(monthExpenses.reduce((groups, expense) => {
    const name = expenseCategory(expense), key = categoryKey(name);
    if (allocatedNames.has(key)) return groups;
    groups[key] ||= { name, spent: 0 };
    groups[key].spent += amountOf(expense);
    return groups;
  }, {})).sort((a, b) => a.name.localeCompare(b.name));
  return {
    actual,
    categories,
    unbudgetedCategories,
    unbudgeted: unbudgetedCategories.reduce((total, category) => total + category.spent, 0),
  };
}
