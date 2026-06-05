import type { Transaction } from '../types';

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export function getUniqueDatesDescending(transactions: Transaction[]): string[] {
  const dates = new Set(transactions.map((item) => item.date));
  return Array.from(dates).sort((a, b) => b.localeCompare(a));
}

export function filterTransactionsByDate(transactions: Transaction[], date: string): Transaction[] {
  return transactions.filter((item) => item.date === date);
}

export function sumTransactions(transactions: Transaction[]): number {
  return transactions.reduce((sum, item) => sum + item.amount, 0);
}

export function formatHistoryDayLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;
  const date = new Date(year, month - 1, day);
  const weekday = WEEKDAY_SHORT[date.getDay()] ?? '';
  const monthName = MONTH_GENITIVE[month - 1] ?? String(month);
  return `${day} ${monthName} · ${weekday}`;
}

export function formatTimelineDay(dateStr: string): { day: string; weekday: string } {
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return { day: dateStr, weekday: '' };
  const date = new Date(year, month - 1, day);
  return {
    day: String(day),
    weekday: WEEKDAY_SHORT[date.getDay()] ?? '',
  };
}
