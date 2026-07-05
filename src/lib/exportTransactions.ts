import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Transaction, TransactionKind } from '../types';

const KIND_LABEL: Record<TransactionKind, string> = {
  income: 'Доход',
  expense: 'Расход',
};

const SOURCE_LABEL: Record<string, string> = {
  manual: 'Вручную',
  voice: 'Голос',
  receipt: 'Чек',
  bank: 'Банк',
  broker: 'T-Invest',
};

const CSV_HEADER = ['Дата', 'Тип', 'Категория', 'Название', 'Сумма', 'Источник'];

function csvCell(value: string): string {
  // Экранируем по RFC 4180: кавычки удваиваем, ячейку с разделителями берём в кавычки.
  if (/[",\n\r;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildTransactionsCsv(transactions: Transaction[]): string {
  const rows = transactions.map((t) =>
    [
      t.date,
      KIND_LABEL[t.kind] ?? t.kind,
      t.category,
      t.title,
      String(t.amount),
      t.source ? (SOURCE_LABEL[t.source] ?? t.source) : '',
    ]
      .map((cell) => csvCell(String(cell)))
      .join(',')
  );
  // \uFEFF (BOM) — чтобы Excel корректно открыл кириллицу в UTF-8.
  // \r\n — перевод строки, дружелюбный к Excel/Numbers.
  return '\uFEFF' + [CSV_HEADER.join(','), ...rows].join('\r\n');
}

export type ExportCsvResult = 'shared' | 'unavailable';

/**
 * Формирует CSV из транзакций, сохраняет во временный файл и открывает
 * системную шторку «Поделиться». Возвращает 'unavailable', если шеринг
 * не поддерживается на устройстве.
 */
export async function exportTransactionsCsv(
  transactions: Transaction[],
  fileName: string
): Promise<ExportCsvResult> {
  const csv = buildTransactionsCsv(transactions);

  const safeName = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  const file = new File(Paths.cache, safeName);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  if (!(await Sharing.isAvailableAsync())) {
    return 'unavailable';
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Экспорт операций',
    UTI: 'public.comma-separated-values-text',
  });
  return 'shared';
}
