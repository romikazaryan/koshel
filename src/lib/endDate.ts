export function formatIsoDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseIsoDate(dateStr: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function isValidIsoDate(dateStr: string) {
  const parsed = parseIsoDate(dateStr);
  if (!parsed) return false;
  return parsed.day <= daysInMonth(parsed.year, parsed.month);
}

export function getDefaultDebtEndDate() {
  const now = new Date();
  now.setFullYear(now.getFullYear() + 3);
  return formatIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** День ежемесячного платежа — берём из выбранной даты (число месяца). */
export function getPaymentDayFromIsoDate(dateStr: string) {
  return parseIsoDate(dateStr)?.day ?? 1;
}
