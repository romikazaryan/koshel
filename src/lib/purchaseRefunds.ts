import type { Transaction } from '../types';

const PURCHASE_REFUND_TITLE_RE =
  /возврат(?:\s+(?:оплаты|покупки|средств|за\b|платежа|товар)|\b)|refund|chargeback|отмена\s*покупки/i;

const DEBT_RETURN_RE = /возврат\s+долг/i;

/** Возврат покупки в банке приходит как зачисление, но это не заработанный доход. */
export function isPurchaseRefund(
  item: Pick<Transaction, 'kind' | 'category' | 'title' | 'note'>
): boolean {
  if (item.kind !== 'income') return false;

  const text = `${item.title} ${item.note ?? ''}`.trim();
  if (item.category === 'Возврат') return true;
  if (DEBT_RETURN_RE.test(text)) return false;
  return PURCHASE_REFUND_TITLE_RE.test(text);
}

export function isEarnedIncome(
  item: Pick<Transaction, 'kind' | 'category' | 'title' | 'note'>
): boolean {
  return item.kind === 'income' && !isPurchaseRefund(item);
}

export function sumPurchaseRefunds(transactions: Transaction[]): number {
  return transactions
    .filter(isPurchaseRefund)
    .reduce((sum, item) => sum + item.amount, 0);
}

export function filterIncomeForDisplay(transactions: Transaction[]): Transaction[] {
  return transactions.filter(isEarnedIncome);
}
