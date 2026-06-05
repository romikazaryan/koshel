export type MonthRef = { year: number; month: number };

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export function getTodayMonth(): MonthRef {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** month — 1..12 */
export function getMonthRange(ref: MonthRef): { start: string; end: string } {
  const y = ref.year;
  const m = ref.month;
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

export function getCurrentMonthRange(): { start: string; end: string } {
  return getMonthRange(getTodayMonth());
}

export function formatMonthLabel(ref: MonthRef): string {
  const name = MONTH_NAMES[ref.month - 1] ?? String(ref.month);
  return `${name} ${ref.year}`;
}

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const date = new Date(ref.year, ref.month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export function isMonthAfter(a: MonthRef, b: MonthRef): boolean {
  if (a.year !== b.year) return a.year > b.year;
  return a.month > b.month;
}

export function isDateInRange(dateStr: string, start: string, end: string): boolean {
  return dateStr >= start && dateStr <= end;
}
