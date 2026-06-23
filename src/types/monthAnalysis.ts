export type AnalysisPeriodMonths = 1 | 6 | 12;

export const ANALYSIS_PERIOD_OPTIONS: Array<{ months: AnalysisPeriodMonths; label: string }> = [
  { months: 1, label: 'Месяц' },
  { months: 6, label: '6 мес' },
  { months: 12, label: 'Год' },
];

export type MonthAnalysisPriority = {
  title: string;
  action: string;
  effect: string;
};

/** Легальные способы вернуть или сохранить деньги: вычеты, накопительные продукты. */
export type MonthAnalysisOptimization = {
  title: string;
  action: string;
  benefit: string;
  kind: 'tax' | 'bank' | 'broker';
};

export type MonthAnalysisResult = {
  headline: string;
  situation: string;
  priorities: MonthAnalysisPriority[];
  optimizations: MonthAnalysisOptimization[];
  watch: string;
  strength: string;
};

export type MonthAnalysisTrendPoint = {
  month: string;
  label: string;
  income: number;
  expenses: number;
  balance: number;
};

export type MonthAnalysisRequestPayload = {
  periodMonths: AnalysisPeriodMonths;
  periodLabel: string;
  monthLabel: string;
  month: string;
  income: number;
  totalExpenses: number;
  balance: number;
  healthScore: number;
  monthlyBudget: number | null;
  savingsRate: number | null;
  expensesByCategory: Array<{ category: string; amount: number; percent: number }>;
  historyMonths: number;
  monthlyTrend: MonthAnalysisTrendPoint[];
  topMerchants: Array<{ title: string; amount: number; count: number }>;
  categoryShifts: Array<{ category: string; current: number; previousAvg: number; changePercent: number }>;
  fixedCosts: Array<{ name: string; amount: number; type: 'subscription' | 'debt' }>;
  fixedCostsTotal: number;
  fixedCostsShare: number;
  facts: string[];
  optimizationHints: string[];
};
