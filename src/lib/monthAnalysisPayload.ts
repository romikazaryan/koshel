import type { Category, Debt, Subscription, Transaction } from '../types';
import type {
  AnalysisPeriodMonths,
  MonthAnalysisRequestPayload,
  MonthAnalysisResult,
  MonthAnalysisTrendPoint,
} from '../types/monthAnalysis';
import { ANALYSIS_PERIOD_OPTIONS } from '../types/monthAnalysis';
import {
  getActiveDebtsForMonth,
  getDebtsTotalForMonth,
} from './debts';
import { formatMonthLabel, getMonthRange, shiftMonth, type MonthRef } from './month';
import { isEarnedIncome, sumPurchaseRefunds } from './purchaseRefunds';
import {
  getActiveSubscriptionsForMonth,
  getSubscriptionsTotalForMonth,
} from './subscriptions';

export { ANALYSIS_PERIOD_OPTIONS };
export type { AnalysisPeriodMonths };

const TOP_MERCHANTS = 5;
const TOP_CATEGORY_SHIFTS = 4;

function monthKey(ref: MonthRef): string {
  return `${ref.year}-${String(ref.month).padStart(2, '0')}`;
}

function monthRefsInPeriod(endRef: MonthRef, periodMonths: number): MonthRef[] {
  const refs: MonthRef[] = [];
  for (let i = periodMonths - 1; i >= 0; i -= 1) {
    refs.push(shiftMonth(endRef, -i));
  }
  return refs;
}

export function formatAnalysisPeriodLabel(endRef: MonthRef, periodMonths: AnalysisPeriodMonths): string {
  if (periodMonths === 1) return formatMonthLabel(endRef);
  const startRef = shiftMonth(endRef, -(periodMonths - 1));
  return `${formatMonthLabel(startRef)} — ${formatMonthLabel(endRef)}`;
}

function normalizeMerchantTitle(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/\s·\s.*/u, '')
    .trim()
    .slice(0, 80);
}

function monthTotals(
  transactions: Transaction[],
  subscriptions: Subscription[],
  debts: Debt[],
  ref: MonthRef
): { income: number; expenses: number; balance: number } {
  const { start, end } = getMonthRange(ref);
  const monthTx = transactions.filter((item) => item.date >= start && item.date <= end);
  const income = monthTx.filter(isEarnedIncome).reduce((sum, item) => sum + item.amount, 0);
  const expenseTx = monthTx
    .filter((item) => item.kind === 'expense')
    .reduce((sum, item) => sum + item.amount, 0);
  const refunds = sumPurchaseRefunds(monthTx);
  const subs = getSubscriptionsTotalForMonth(subscriptions, ref);
  const debtPay = getDebtsTotalForMonth(debts, ref);
  const expenses = expenseTx - refunds + subs + debtPay;
  return { income, expenses, balance: income - expenses };
}

function buildCategorySummary(
  transactions: Transaction[],
  subscriptions: Subscription[],
  debts: Debt[],
  ref: MonthRef
): Array<{ category: string; amount: number }> {
  const { start, end } = getMonthRange(ref);
  const grouping = new Map<Category, number>();

  transactions
    .filter((item) => item.kind === 'expense' && item.date >= start && item.date <= end)
    .forEach((item) => {
      const cat = item.category as Category;
      grouping.set(cat, (grouping.get(cat) ?? 0) + item.amount);
    });

  getActiveSubscriptionsForMonth(subscriptions, ref).forEach((sub) => {
    const cat = sub.category as Category;
    grouping.set(cat, (grouping.get(cat) ?? 0) + sub.amount);
  });

  getActiveDebtsForMonth(debts, ref).forEach((debt) => {
    grouping.set('Другое', (grouping.get('Другое') ?? 0) + debt.monthlyPayment);
  });

  return Array.from(grouping.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function buildPeriodCategorySummary(
  transactions: Transaction[],
  subscriptions: Subscription[],
  debts: Debt[],
  endRef: MonthRef,
  periodMonths: AnalysisPeriodMonths
) {
  const grouping = new Map<string, number>();
  for (const ref of monthRefsInPeriod(endRef, periodMonths)) {
    buildCategorySummary(transactions, subscriptions, debts, ref).forEach((item) => {
      grouping.set(item.category, (grouping.get(item.category) ?? 0) + item.amount);
    });
  }
  return Array.from(grouping.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function buildPeriodTopMerchants(
  transactions: Transaction[],
  endRef: MonthRef,
  periodMonths: AnalysisPeriodMonths
) {
  const startRef = shiftMonth(endRef, -(periodMonths - 1));
  const { start } = getMonthRange(startRef);
  const { end } = getMonthRange(endRef);
  const grouping = new Map<string, { amount: number; count: number }>();

  transactions
    .filter((item) => item.kind === 'expense' && item.date >= start && item.date <= end)
    .forEach((item) => {
      const title = normalizeMerchantTitle(item.title);
      if (!title) return;
      const prev = grouping.get(title) ?? { amount: 0, count: 0 };
      grouping.set(title, { amount: prev.amount + item.amount, count: prev.count + 1 });
    });

  return Array.from(grouping.entries())
    .map(([title, stats]) => ({ title, ...stats }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, TOP_MERCHANTS);
}

function buildCategoryShifts(
  transactions: Transaction[],
  subscriptions: Subscription[],
  debts: Debt[],
  endRef: MonthRef,
  periodMonths: AnalysisPeriodMonths
) {
  if (periodMonths <= 1) return [];

  const current = buildCategorySummary(transactions, subscriptions, debts, endRef);
  const previous: Array<Map<string, number>> = [];

  for (let i = 1; i < periodMonths; i += 1) {
    const ref = shiftMonth(endRef, -i);
    const summary = buildCategorySummary(transactions, subscriptions, debts, ref);
    previous.push(new Map(summary.map((item) => [item.category, item.amount])));
  }

  if (previous.length === 0) return [];

  return current
    .map((item) => {
      const prevSum = previous.reduce((sum, map) => sum + (map.get(item.category) ?? 0), 0);
      const previousAvg = prevSum / previous.length;
      const changePercent =
        previousAvg > 0 ? Math.round(((item.amount - previousAvg) / previousAvg) * 100) : 0;
      return {
        category: item.category,
        current: item.amount,
        previousAvg: Math.round(previousAvg),
        changePercent,
      };
    })
    .filter((item) => item.current >= 500 || Math.abs(item.changePercent) >= 15)
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    .slice(0, TOP_CATEGORY_SHIFTS);
}

function buildPeriodFixedCosts(
  subscriptions: Subscription[],
  debts: Debt[],
  endRef: MonthRef,
  periodMonths: AnalysisPeriodMonths
) {
  let fixedCostsTotal = 0;
  for (const ref of monthRefsInPeriod(endRef, periodMonths)) {
    fixedCostsTotal += getSubscriptionsTotalForMonth(subscriptions, ref);
    fixedCostsTotal += getDebtsTotalForMonth(debts, ref);
  }

  const fixedCosts = [
    ...getActiveSubscriptionsForMonth(subscriptions, endRef).map((sub) => ({
      name: sub.name,
      amount: sub.amount,
      type: 'subscription' as const,
    })),
    ...getActiveDebtsForMonth(debts, endRef).map((debt) => ({
      name: debt.name,
      amount: debt.monthlyPayment,
      type: 'debt' as const,
    })),
  ];

  return { fixedCosts, fixedCostsTotal };
}

function buildFacts(payload: Omit<MonthAnalysisRequestPayload, 'facts'>): string[] {
  const facts: string[] = [];
  const trend = payload.monthlyTrend;

  if (payload.periodMonths > 1 && trend.length >= 2) {
    const avgExpenses = trend.reduce((sum, item) => sum + item.expenses, 0) / trend.length;
    const maxExpenses = Math.max(...trend.map((item) => item.expenses));
    const minExpenses = Math.min(...trend.map((item) => item.expenses));
    if (maxExpenses - minExpenses >= avgExpenses * 0.2) {
      facts.push(
        `Разброс расходов по месяцам: от ${Math.round(minExpenses).toLocaleString('ru-RU')} до ${Math.round(maxExpenses).toLocaleString('ru-RU')} ₽`
      );
    }
  }

  if (trend.length >= 2) {
    const current = trend[trend.length - 1];
    const prev = trend.slice(0, -1);
    const avgExpenses = prev.reduce((sum, item) => sum + item.expenses, 0) / prev.length;
    if (avgExpenses > 0) {
      const change = Math.round(((current.expenses - avgExpenses) / avgExpenses) * 100);
      if (Math.abs(change) >= 8) {
        facts.push(
          `Последний месяц: расходы ${change > 0 ? 'выше' : 'ниже'} среднего за период на ${Math.abs(change)}%`
        );
      }
    }
  }

  if (payload.savingsRate != null) {
    if (payload.savingsRate >= 20) {
      facts.push(`Норма сбережений ${payload.savingsRate}% — выше типичных 10–15%`);
    } else if (payload.savingsRate < 0) {
      facts.push(
        payload.periodMonths === 1
          ? 'Расходы превышают доход — месяц в минус'
          : 'За период расходы превышают доход'
      );
    } else if (payload.savingsRate < 10 && payload.income > 0) {
      facts.push(`Низкая норма сбережений: ${payload.savingsRate}% от дохода`);
    }
  }

  if (payload.fixedCostsShare >= 35) {
    facts.push(
      `Фиксированные платежи (подписки + кредиты) — ${payload.fixedCostsShare}% расходов`
    );
  }

  if (payload.monthlyBudget != null) {
    const budgetCap = payload.monthlyBudget * payload.periodMonths;
    if (payload.totalExpenses > budgetCap) {
      const over = payload.totalExpenses - budgetCap;
      facts.push(`Превышен лимит трат на ${Math.round(over).toLocaleString('ru-RU')} ₽`);
    }
  }

  payload.categoryShifts.slice(0, 2).forEach((shift) => {
    if (Math.abs(shift.changePercent) >= 20) {
      facts.push(
        `«${shift.category}»: ${shift.changePercent > 0 ? '+' : ''}${shift.changePercent}% к среднему`
      );
    }
  });

  return facts.slice(0, 6);
}

function categoryAmount(
  categories: Array<{ category: string; amount: number }>,
  name: string
): number {
  return categories.find((item) => item.category === name)?.amount ?? 0;
}

function buildOptimizationHints(input: {
  balance: number;
  income: number;
  periodMonths: number;
  expensesByCategory: Array<{ category: string; amount: number }>;
  fixedCosts: Array<{ name: string; type: 'subscription' | 'debt' }>;
  savingsRate: number | null;
}): string[] {
  const hints: string[] = [];
  const months = Math.max(input.periodMonths, 1);
  const monthlyIncome = input.income / months;
  const annualIncomeEst = Math.round(monthlyIncome * 12);

  if (input.income > 0 && annualIncomeEst <= 650_000) {
    hints.push(
      'Стандартный вычет 13% с зарплаты — до ~15 600 ₽/год; оформите через работодателя или декларацию 3-НДФЛ'
    );
  }

  const healthSpend = categoryAmount(input.expensesByCategory, 'Здоровье');
  if (healthSpend >= 15_000) {
    hints.push(
      `Медрасходы ~${Math.round(healthSpend).toLocaleString('ru-RU')} ₽ за период — социальный вычет 13% (лимит ~150 000 ₽/год на лечение)`
    );
  }

  const hasDebt = input.fixedCosts.some((item) => item.type === 'debt');
  const zhkhSpend = categoryAmount(input.expensesByCategory, 'ЖКХ');
  if (hasDebt || zhkhSpend >= 40_000) {
    hints.push(
      'При ипотеке: имущественный вычет до 260 000 ₽ с покупки + до 390 000 ₽ с процентов; проверьте остаток лимита'
    );
  }

  if (input.balance >= 50_000) {
    hints.push(
      `Свободные средства ~${Math.round(input.balance).toLocaleString('ru-RU')} ₽ — накопительный счёт или ИИС типа А (возврат 13% с взноса до 400 000 ₽/год)`
    );
  } else if (input.savingsRate != null && input.savingsRate >= 8 && input.balance >= 20_000) {
    hints.push(
      'Положительный баланс — перенесите «мертвые» деньги с карты на накопительный счёт с повышенной ставкой'
    );
  }

  if (input.balance >= 150_000 && input.savingsRate != null && input.savingsRate >= 12) {
    hints.push(
      'Длинный горизонт — ИИС тип Б: освобождение от НДФЛ с инвестдохода (без рекомендаций конкретных бумаг)'
    );
  }

  return hints.slice(0, 5);
}

export function getAnalysisDateRange(
  selectedMonth: MonthRef,
  periodMonths: AnalysisPeriodMonths = 6
): { start: string; end: string } {
  const startRef = shiftMonth(selectedMonth, -(periodMonths - 1));
  return {
    start: getMonthRange(startRef).start,
    end: getMonthRange(selectedMonth).end,
  };
}

export function analysisPeriodHint(periodMonths: AnalysisPeriodMonths): string {
  if (periodMonths === 1) return 'анализируем выбранный месяц';
  if (periodMonths === 12) return 'анализируем год до выбранного месяца';
  return 'анализируем 6 месяцев до выбранного месяца';
}

export function buildMonthAnalysisPayload(input: {
  transactions: Transaction[];
  subscriptions: Subscription[];
  debts: Debt[];
  selectedMonth: MonthRef;
  periodMonths: AnalysisPeriodMonths;
  monthlyBudget: number | null;
  healthScore: number;
}): MonthAnalysisRequestPayload {
  const { transactions, subscriptions, debts, selectedMonth, periodMonths, monthlyBudget, healthScore } =
    input;

  const monthlyTrend: MonthAnalysisTrendPoint[] = monthRefsInPeriod(selectedMonth, periodMonths).map(
    (ref) => {
      const totals = monthTotals(transactions, subscriptions, debts, ref);
      return {
        month: monthKey(ref),
        label: formatMonthLabel(ref),
        ...totals,
      };
    }
  );

  const periodIncome = monthlyTrend.reduce((sum, item) => sum + item.income, 0);
  const periodExpenses = monthlyTrend.reduce((sum, item) => sum + item.expenses, 0);
  const periodBalance = periodIncome - periodExpenses;

  const categoryRows = buildPeriodCategorySummary(
    transactions,
    subscriptions,
    debts,
    selectedMonth,
    periodMonths
  );
  const expensesByCategory = categoryRows.map((item) => ({
    category: item.category,
    amount: item.amount,
    percent: periodExpenses > 0 ? Math.round((item.amount / periodExpenses) * 100) : 0,
  }));

  const { fixedCosts, fixedCostsTotal } = buildPeriodFixedCosts(
    subscriptions,
    debts,
    selectedMonth,
    periodMonths
  );

  const periodLabel = formatAnalysisPeriodLabel(selectedMonth, periodMonths);

  const base: Omit<MonthAnalysisRequestPayload, 'facts'> = {
    periodMonths,
    periodLabel,
    monthLabel: periodLabel,
    month: monthKey(selectedMonth),
    income: periodIncome,
    totalExpenses: periodExpenses,
    balance: periodBalance,
    healthScore,
    monthlyBudget,
    savingsRate:
      periodIncome > 0 ? Math.round((periodBalance / periodIncome) * 100) : null,
    expensesByCategory,
    historyMonths: periodMonths,
    monthlyTrend,
    topMerchants: buildPeriodTopMerchants(transactions, selectedMonth, periodMonths),
    categoryShifts: buildCategoryShifts(
      transactions,
      subscriptions,
      debts,
      selectedMonth,
      periodMonths
    ),
    fixedCosts,
    fixedCostsTotal,
    fixedCostsShare:
      periodExpenses > 0 ? Math.round((fixedCostsTotal / periodExpenses) * 100) : 0,
    optimizationHints: buildOptimizationHints({
      balance: periodBalance,
      income: periodIncome,
      periodMonths,
      expensesByCategory,
      fixedCosts,
      savingsRate:
        periodIncome > 0 ? Math.round((periodBalance / periodIncome) * 100) : null,
    }),
  };

  return { ...base, facts: buildFacts(base) };
}

export function parseMonthAnalysisResult(raw: unknown): MonthAnalysisResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;

  const headline = String(data.headline ?? '').trim();
  const situation = String(data.situation ?? '').trim();
  const watch = String(data.watch ?? '').trim();
  const strength = String(data.strength ?? '').trim();

  const prioritiesRaw = Array.isArray(data.priorities) ? data.priorities : [];
  const priorities = prioritiesRaw
    .slice(0, 3)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? '').trim();
      const action = String(row.action ?? '').trim();
      const effect = String(row.effect ?? row.saveMonthly ?? '').trim();
      if (!title || !action) return null;
      return { title, action, effect: effect || 'Снизит давление на бюджет' };
    })
    .filter((item): item is MonthAnalysisResult['priorities'][number] => item != null);

  const optimizationsRaw = Array.isArray(data.optimizations) ? data.optimizations : [];
  const optimizations = optimizationsRaw
    .slice(0, 2)
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const title = String(row.title ?? '').trim();
      const action = String(row.action ?? '').trim();
      const benefit = String(row.benefit ?? row.effect ?? '').trim();
      const kindRaw = String(row.kind ?? 'bank');
      const kind =
        kindRaw === 'tax' || kindRaw === 'broker' || kindRaw === 'bank' ? kindRaw : 'bank';
      if (!title || !action) return null;
      return { title, action, benefit: benefit || 'Экономия или возврат средств', kind };
    })
    .filter((item): item is MonthAnalysisResult['optimizations'][number] => item != null);

  if (!headline || priorities.length === 0) return null;
  return {
    headline,
    situation: situation || 'Краткая оценка по вашим данным за выбранный период.',
    priorities,
    optimizations,
    watch: watch || 'Следите за импульсными тратами вне бюджета.',
    strength: strength || 'Вы уже ведёте учёт — это половина успеха.',
  };
}

/** Совместимость со старым форматом (один текст). */
export function legacyTextFromAnalysis(result: MonthAnalysisResult): string {
  const blocks = [
    result.headline,
    '',
    result.situation,
    '',
    'Приоритеты:',
    ...result.priorities.map(
      (item, index) =>
        `${index + 1}. ${item.title}\n${item.action}${item.effect ? `\n→ ${item.effect}` : ''}`
    ),
    ...(result.optimizations.length > 0
      ? [
          '',
          'Как сохранить или вернуть:',
          ...result.optimizations.map(
            (item, index) =>
              `${index + 1}. ${item.title}\n${item.action}${item.benefit ? `\n→ ${item.benefit}` : ''}`
          ),
        ]
      : []),
    '',
    `На контроле: ${result.watch}`,
    `Сильная сторона: ${result.strength}`,
  ];
  return blocks.join('\n');
}
