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

const MONTH_NAMES_GENITIVE = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

/** Родительный падеж месяца для подписей вида «за май». */
export function formatMonthGenitive(ref: MonthRef): string {
  return MONTH_NAMES_GENITIVE[ref.month - 1] ?? String(ref.month);
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

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Все дни месяца от последнего к первому; для текущего месяца — не дальше сегодня. */
export function getMonthDatesDescending(ref: MonthRef): string[] {
  const { start, end } = getMonthRange(ref);
  const today = getTodayIsoDate();
  const capEnd = end > today ? today : end;
  if (capEnd < start) return [];

  const lastDay = Number(capEnd.slice(8, 10));
  const dates: string[] = [];
  for (let day = lastDay; day >= 1; day -= 1) {
    dates.push(toIsoDate(ref.year, ref.month, day));
  }
  return dates;
}
