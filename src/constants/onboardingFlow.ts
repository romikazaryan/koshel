import type {
  IncomeRange,
  OnboardingGoal,
  SavingsCushion,
  SpendingPreset,
} from '../types/onboarding';

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

export const INCOME_OPTIONS: ChipOption<IncomeRange>[] = [
  { value: 'under_50k', label: 'До 50 000 ₽' },
  { value: '50_100k', label: '50–100 тыс.' },
  { value: '100_150k', label: '100–150 тыс.' },
  { value: '150_250k', label: '150–250 тыс.' },
  { value: 'over_250k', label: 'Больше 250 тыс.' },
  { value: 'skip', label: 'Пропустить', hint: 'Не обязательно' },
];

/** Середина диапазона дохода — для подсказки лимита трат. */
export const INCOME_MIDPOINT_RUB: Record<Exclude<IncomeRange, 'skip'>, number> = {
  under_50k: 35_000,
  '50_100k': 75_000,
  '100_150k': 125_000,
  '150_250k': 200_000,
  over_250k: 300_000,
};

export type SpendingOption = ChipOption<SpendingPreset> & { budgetRub?: number };

export function spendingOptionsForIncome(income: IncomeRange | null): SpendingOption[] {
  if (!income || income === 'skip') {
    return [
      { value: 'under_40k', label: 'До 40 тыс.', budgetRub: 35_000 },
      { value: '40_70k', label: '40–70 тыс.', budgetRub: 55_000 },
      { value: '70_100k', label: '70–100 тыс.', budgetRub: 85_000 },
      { value: '100_150k', label: '100–150 тыс.', budgetRub: 125_000 },
      { value: '150_plus', label: 'Больше 150 тыс.', budgetRub: 175_000 },
      { value: 'custom', label: 'Своя сумма' },
      { value: 'skip', label: 'Пропустить', hint: 'Настрою позже' },
    ];
  }

  const mid = INCOME_MIDPOINT_RUB[income];
  const fmt = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)} тыс.` : `${n.toLocaleString('ru-RU')} ₽`;

  return [
    {
      value: 'frugal',
      label: 'Экономно',
      hint: `~${fmt(mid * 0.6)}`,
      budgetRub: Math.round(mid * 0.6),
    },
    {
      value: 'moderate',
      label: 'Умеренно',
      hint: `~${fmt(mid * 0.75)}`,
      budgetRub: Math.round(mid * 0.75),
    },
    {
      value: 'comfortable',
      label: 'Комфортно',
      hint: `~${fmt(mid * 0.9)}`,
      budgetRub: Math.round(mid * 0.9),
    },
    { value: 'custom', label: 'Своя сумма' },
    { value: 'skip', label: 'Пропустить', hint: 'Настрою позже' },
  ];
}

export const SAVINGS_OPTIONS: ChipOption<SavingsCushion>[] = [
  { value: 'none', label: 'Пока нет', hint: 'Начну копить' },
  { value: 'under_1m', label: 'Меньше месяца расходов' },
  { value: '1_3m', label: '1–3 месяца', hint: 'Хорошая подушка' },
  { value: '3m_plus', label: '3+ месяца' },
  { value: 'skip', label: 'Пропустить' },
];

export const GOAL_OPTIONS: ChipOption<OnboardingGoal>[] = [
  { value: 'control_spending', label: 'Контролировать траты' },
  { value: 'save', label: 'Копить и откладывать' },
  { value: 'subscriptions', label: 'Следить за подписками' },
  { value: 'investments', label: 'Видеть капитал' },
  { value: 'explore', label: 'Просто попробовать' },
  { value: 'skip', label: 'Пропустить' },
];

export const ONBOARDING_QUESTION_COUNT = 4;

export const GOAL_LABELS: Record<Exclude<OnboardingGoal, 'skip'>, string> = {
  control_spending: 'контроль трат',
  save: 'накопления',
  subscriptions: 'подписки',
  investments: 'капитал',
  explore: 'знакомство с приложением',
};

export const SAVINGS_LABELS: Record<Exclude<SavingsCushion, 'skip'>, string> = {
  none: 'подушка пока не сформирована',
  under_1m: 'небольшой запас',
  '1_3m': 'подушка на 1–3 месяца',
  '3m_plus': 'солидная подушка',
};
