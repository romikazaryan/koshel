import type { TransactionSource } from '../types';

const LABELS: Record<TransactionSource, string> = {
  manual: 'Вручную',
  voice: 'Голос',
  receipt: 'Чек',
  bank: 'Банк',
};

export function getTransactionSourceLabel(source?: TransactionSource) {
  if (!source) return LABELS.manual;
  return LABELS[source] ?? LABELS.manual;
}
