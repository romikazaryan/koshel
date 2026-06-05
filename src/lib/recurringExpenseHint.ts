export function formatRecurringExpenseHint(subscriptionsTotal: number, debtsTotal: number): string | null {
  const parts: string[] = [];
  if (subscriptionsTotal > 0) {
    parts.push(`подписки ₽${subscriptionsTotal.toLocaleString('ru-RU')}`);
  }
  if (debtsTotal > 0) {
    parts.push(`кредиты ₽${debtsTotal.toLocaleString('ru-RU')}`);
  }
  if (parts.length === 0) return null;
  return `в т.ч. ${parts.join(' · ')}`;
}
