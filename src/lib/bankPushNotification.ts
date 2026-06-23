import type { Category, TransactionKind } from '../types';
import { inferExpenseCategory } from './transactionCategory';

function parseAmountToken(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

export type ParsedBankPush = {
  amount: number;
  kind: TransactionKind;
  title: string;
  category: Category;
};

/** Парсит текст пуша/СМС банка: «Списание 1 500,00 RUB MAGNIT». */
export function parseBankPushNotification(text: string): ParsedBankPush | null {
  const normalized = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalized.length < 8) return null;

  const lower = normalized.toLowerCase();
  if (!/(списан|покупк|оплат|перевод|зачисл|поступлен|пополнен|rub|₽|руб)/i.test(lower)) {
    return null;
  }

  const amountMatch =
    normalized.match(/([-+]?)\s*(\d[\d\s]*(?:[.,]\d{2})?)\s*(?:₽|руб\.?|rub|rur)\b/i) ??
    normalized.match(/(?:на\s+сумму\s+)(\d[\d\s]*(?:[.,]\d{2})?)/i);

  if (!amountMatch) return null;

  const amount = parseAmountToken(amountMatch[2] ?? '');
  if (!amount) return null;

  const kind: TransactionKind =
    /зачисл|поступлен|пополнен|возврат\s+средств/i.test(lower) &&
    !/списан|покупк|оплат/i.test(lower)
      ? 'income'
      : 'expense';

  let title = 'Операция по карте';
  const afterCurrency = normalized.match(/(?:₽|руб\.?|rub|rur)\s*[.;:,\-–—]?\s*(.+)$/i);
  if (afterCurrency?.[1]) {
    title = afterCurrency[1].replace(/\s*баланс.*/i, '').trim().slice(0, 80);
  } else {
    const beforeCurrency = normalized.match(/^(.+?)\s+\d[\d\s]*(?:[.,]\d{2})?\s*(?:₽|руб|rub)/i);
    if (beforeCurrency?.[1]) {
      title = beforeCurrency[1].replace(/^(списание|покупка|оплата)\s*/i, '').trim().slice(0, 80);
    }
  }

  if (!title || title.length < 2) title = 'Операция по карте';

  return {
    amount,
    kind,
    title,
    category: inferExpenseCategory(title),
  };
}

export function isLikelyBankPushText(text: string): boolean {
  return parseBankPushNotification(text) != null;
}
