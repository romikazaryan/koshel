import {
  BANK_STATEMENT_PROVIDER_LABELS,
  detectBankFromCsvHeaders,
  detectBankFromFileName,
  detectBankFromPdfText,
  getBankStatementProviderLabel,
  isBankStatementProviderId,
} from '../constants/bankStatementProviders';
import { isPurchaseRefund } from './purchaseRefunds';
import { inferExpenseCategory, inferIncomeCategory } from './transactionCategory';
import {
  applyOwnFundsFlags,
  buildStableExternalId,
  extractStatementAccountOwner,
  resolveInternalTransfer,
  shouldExcludeStatementRow,
  type StatementCardKind,
} from './statementImportRules';
import type { TransactionKind } from '../types';

export type { StatementCardKind };

export type StatementImportContext = {
  accountOwner?: string | null;
};

export type StatementBankFormat = 'tbank' | 'sber' | 'ozon' | 'generic';

export type ParsedStatementRow = {
  date: string;
  amount: number;
  kind: TransactionKind;
  title: string;
  category: string;
  note?: string;
  externalId: string;
  cardLast4?: string;
  internalTransfer?: boolean;
  skipped?: boolean;
  skipReason?: string;
};

export type StatementParseResult = {
  format: StatementBankFormat;
  formatLabel: string;
  fileName: string;
  rows: ParsedStatementRow[];
  skipped: ParsedStatementRow[];
  expenses: number;
  income: number;
  expenseTotal: number;
  incomeTotal: number;
  dateFrom: string | null;
  dateTo: string | null;
  detectedCardKind?: StatementCardKind;
  cardLast4?: string;
  accountOwner?: string | null;
};

export type BankStatementImportRow = {
  date: string;
  amount: number;
  kind: TransactionKind;
  title: string;
  category: string;
  note?: string;
  externalId: string;
  cardLast4?: string;
};

function providerFormatLabel(providerId?: string): string | undefined {
  if (!providerId) return undefined;
  return getBankStatementProviderLabel(providerId) ?? undefined;
}

const DATE_HEADERS = [
  'дата',
  'date',
  'дата операции',
  'дата проведения',
  'дата транзакции',
  'transaction date',
];

const AMOUNT_HEADERS = [
  'сумма',
  'amount',
  'сумма операции',
  'сумма в валюте счета',
  'сумма в валюте',
  'сумма в валюте операции',
  'transaction amount',
];

const DEBIT_AMOUNT_HEADERS = [
  'списание',
  'дебет',
  'расход',
  'сумма списания',
  'снятие',
  'outgoing',
  'расходы',
];

const CREDIT_AMOUNT_HEADERS = [
  'зачисление',
  'кредит',
  'поступление',
  'сумма зачисления',
  'приход',
  'incoming',
  'доходы',
];

const DESC_HEADERS = [
  'описание',
  'description',
  'назначение платежа',
  'назначение',
  'merchant',
  'описание операции',
  'детали',
];

const CATEGORY_HEADERS = ['категория', 'category', 'mcc', 'код категории'];

const TYPE_HEADERS = ['тип', 'type', 'тип операции', 'направление', 'дебет/кредит'];

const BROKER_TRANSFER_KEYWORDS = ['пополнение брокерского', 'пополнение инвест'];

function isBrokerTransfer(description: string) {
  const lower = description.toLowerCase();
  return BROKER_TRANSFER_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/** Пропускаем при импорте с учётом типа счёта, под который загружена выписка. */
export function shouldExcludeFromImport(
  row: ParsedStatementRow,
  cardKind: StatementCardKind,
  context?: StatementImportContext
): boolean {
  return shouldExcludeStatementRow(row, cardKind, context?.accountOwner);
}

export function accountKindImportHint(cardKind: StatementCardKind): string {
  if (cardKind === 'credit') {
    return 'Покупки по карте и бонусы (кэшбэк, акции). Погашение кредитки не импортируем — долг уже отражён в расходах.';
  }
  return 'Покупки и списания со счёта. Переводы себе и погашение кредитки не импортируем — это не траты.';
}

/** Какие строки реально отправляем в БД с учётом типа счёта. */
export function rowsForImport(
  rows: ParsedStatementRow[],
  cardKind: StatementCardKind,
  context?: StatementImportContext
): ParsedStatementRow[] {
  return rows.filter((row) => !shouldExcludeFromImport(row, cardKind, context));
}

export function importRowCounts(
  rows: ParsedStatementRow[],
  cardKind: StatementCardKind,
  context?: StatementImportContext
) {
  const importRows = rowsForImport(rows, cardKind, context);
  const excluded = rows.filter((row) => shouldExcludeFromImport(row, cardKind, context));
  const expenses = importRows.filter((row) => row.kind === 'expense');
  const income = importRows.filter((row) => row.kind === 'income' && !isParsedPurchaseRefund(row));
  const refunds = importRows.filter((row) => isParsedPurchaseRefund(row));
  const months = [...new Set(importRows.map((row) => row.date.slice(0, 7)))].sort();
  return {
    importRows,
    excludedRows: excluded,
    excludedSamples: excluded.slice(0, 3).map((row) => ({
      title: row.title.slice(0, 60),
      amount: row.amount,
      kind: row.kind,
    })),
    importCount: importRows.length,
    excludedCount: excluded.length,
    excludedLabel:
      cardKind === 'credit' ? 'погашение кредитки' : 'переводы между своими счетами',
    expenseCount: expenses.length,
    incomeCount: income.length,
    refundCount: refunds.length,
    importExpenseTotal: expenses.reduce((sum, row) => sum + row.amount, 0),
    importIncomeTotal: income.reduce((sum, row) => sum + row.amount, 0),
    refundTotal: refunds.reduce((sum, row) => sum + row.amount, 0),
    months,
  };
}

function isParsedPurchaseRefund(row: Pick<ParsedStatementRow, 'kind' | 'category' | 'title'>) {
  return isPurchaseRefund(row);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/"/g, '');
}

function detectDelimiter(sample: string): string {
  const semicolons = (sample.match(/;/g) ?? []).length;
  const commas = (sample.match(/,/g) ?? []).length;
  return semicolons >= commas ? ';' : ',';
}

function parseCsvRows(content: string): string[][] {
  const text = content.replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  const delimiter = detectDelimiter(text.slice(0, 2000));
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      row.push(cell.trim());
      cell = '';
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(cell.trim());
      if (row.some((part) => part.length > 0)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some((part) => part.length > 0)) rows.push(row);
  }

  return rows;
}

function findHeaderIndex(headers: string[], aliases: string[]) {
  return headers.findIndex((header) => aliases.some((alias) => header.includes(alias)));
}

function detectFormat(
  headers: string[],
  providerId?: string
): { format: StatementBankFormat; label: string } {
  if (providerId === 'tbank') {
    return { format: 'tbank', label: BANK_STATEMENT_PROVIDER_LABELS.tbank };
  }
  if (providerId === 'sber') {
    return { format: 'sber', label: BANK_STATEMENT_PROVIDER_LABELS.sber };
  }

  const detectedFromHeaders = detectBankFromCsvHeaders(headers);
  if (detectedFromHeaders === 'tbank') {
    return { format: 'tbank', label: BANK_STATEMENT_PROVIDER_LABELS.tbank };
  }
  if (detectedFromHeaders === 'sber') {
    return { format: 'sber', label: BANK_STATEMENT_PROVIDER_LABELS.sber };
  }

  const joined = headers.join(' ');
  if (joined.includes('тинькофф') || joined.includes('t-bank') || joined.includes('tinkoff')) {
    return { format: 'tbank', label: BANK_STATEMENT_PROVIDER_LABELS.tbank };
  }
  if (joined.includes('сбер') || joined.includes('sber')) {
    return { format: 'sber', label: BANK_STATEMENT_PROVIDER_LABELS.sber };
  }
  if (joined.includes('дата операции') && joined.includes('описание')) {
    return { format: 'tbank', label: `${BANK_STATEMENT_PROVIDER_LABELS.tbank} (по колонкам)` };
  }

  const providerLabel = providerFormatLabel(providerId);
  if (providerLabel) {
    return { format: 'generic', label: providerLabel };
  }
  if (detectedFromHeaders && isBankStatementProviderId(detectedFromHeaders)) {
    return { format: 'generic', label: BANK_STATEMENT_PROVIDER_LABELS[detectedFromHeaders] };
  }

  return { format: 'generic', label: 'Универсальный CSV' };
}

function parseDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dotted = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (dotted) {
    const year = dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3];
    return `${year}-${dotted[2].padStart(2, '0')}-${dotted[1].padStart(2, '0')}`;
  }

  const dashed = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (dashed) {
    const year = dashed[3].length === 2 ? `20${dashed[3]}` : dashed[3];
    return `${year}-${dashed[2].padStart(2, '0')}-${dashed[1].padStart(2, '0')}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function parseAmount(value: string): number | null {
  const cleaned = value
    .replace(/\u2212/g, '-')
    .replace(/\s/g, '')
    .replace(/\u00a0/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? Math.abs(num) : null;
}

function resolveKind(amountRaw: string, amount: number, typeValue?: string): TransactionKind {
  const type = (typeValue ?? '').toLowerCase();
  if (type.includes('кредит') || type.includes('credit') || type.includes('поступ')) {
    return 'income';
  }
  if (
    type.includes('дебет') ||
    type.includes('debit') ||
    type.includes('расход') ||
    type.includes('списан')
  ) {
    return 'expense';
  }

  const raw = amountRaw.replace(/\u2212/g, '-').replace(/\s/g, '');
  if (raw.startsWith('+')) return 'income';
  if (raw.startsWith('-')) return 'expense';
  if (raw.includes('-') && amount > 0) return 'expense';

  return 'expense';
}

function buildExternalId(input: {
  providerId?: string;
  date: string;
  amount: number;
  kind: TransactionKind;
  title: string;
  cardLast4?: string;
  time?: string;
  documentId?: string;
}) {
  return buildStableExternalId({
    providerId: input.providerId,
    date: input.date,
    amount: input.amount,
    kind: input.kind,
    cardLast4: input.cardLast4,
    time: input.time,
    documentId: input.documentId,
    titleFallback: input.title,
  });
}

function findHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 12); i += 1) {
    const normalized = rows[i].map(normalizeHeader);
    const hasDate = findHeaderIndex(normalized, DATE_HEADERS) >= 0;
    const hasSingleAmount = findHeaderIndex(normalized, AMOUNT_HEADERS) >= 0;
    const hasSplitAmount =
      findHeaderIndex(normalized, DEBIT_AMOUNT_HEADERS) >= 0 &&
      findHeaderIndex(normalized, CREDIT_AMOUNT_HEADERS) >= 0;
    if (hasDate && (hasSingleAmount || hasSplitAmount)) {
      return i;
    }
  }
  return 0;
}

export function parseBankStatementCsv(
  content: string,
  fileName: string,
  providerId?: string
): StatementParseResult {
  const table = parseCsvRows(content);
  if (table.length < 2) {
    throw new Error('Файл пустой или не похож на CSV-выписку.');
  }

  const headerRowIndex = findHeaderRow(table);
  const headers = table[headerRowIndex].map(normalizeHeader);
  const resolvedProviderId =
    providerId ?? detectBankFromCsvHeaders(headers) ?? detectBankFromFileName(fileName) ?? undefined;
  const { format, label } = detectFormat(headers, resolvedProviderId);

  const dateIdx = findHeaderIndex(headers, DATE_HEADERS);
  const amountIdx = findHeaderIndex(headers, AMOUNT_HEADERS);
  const debitIdx = findHeaderIndex(headers, DEBIT_AMOUNT_HEADERS);
  const creditIdx = findHeaderIndex(headers, CREDIT_AMOUNT_HEADERS);
  const hasSplitAmounts = debitIdx >= 0 && creditIdx >= 0;
  const descIdx = findHeaderIndex(headers, DESC_HEADERS);
  const categoryIdx = findHeaderIndex(headers, CATEGORY_HEADERS);
  const typeIdx = findHeaderIndex(headers, TYPE_HEADERS);

  if (dateIdx < 0 || (amountIdx < 0 && !hasSplitAmounts)) {
    throw new Error('Не нашли колонки «Дата» и «Сумма». Проверьте формат выписки.');
  }

  const parsed: ParsedStatementRow[] = [];
  const skipped: ParsedStatementRow[] = [];

  for (let i = headerRowIndex + 1; i < table.length; i += 1) {
    const cells = table[i];
    if (cells.every((cell) => !cell.trim())) continue;

    const date = parseDate(cells[dateIdx] ?? '');
    const description = (
      descIdx >= 0 ? cells[descIdx] : cells.find((c) => c.length > 3) ?? ''
    ).trim();
    const bankCategory = categoryIdx >= 0 ? cells[categoryIdx]?.trim() : undefined;
    const typeValue = typeIdx >= 0 ? cells[typeIdx] : undefined;

    let amountRaw = '';
    let amount: number | null = null;
    let kind: TransactionKind = 'expense';

    if (hasSplitAmounts) {
      const debitRaw = cells[debitIdx] ?? '';
      const creditRaw = cells[creditIdx] ?? '';
      const debitAmt = parseAmount(debitRaw);
      const creditAmt = parseAmount(creditRaw);

      if (debitAmt != null && debitAmt > 0) {
        amount = debitAmt;
        amountRaw = debitRaw.trim().startsWith('-') ? debitRaw : `-${debitRaw}`;
        kind = resolveKind(amountRaw, amount, typeValue);
      } else if (creditAmt != null && creditAmt > 0) {
        amount = creditAmt;
        amountRaw = creditRaw.trim().startsWith('+') ? creditRaw : `+${creditRaw}`;
        kind = resolveKind(amountRaw, amount, typeValue);
      } else {
        continue;
      }
    } else {
      amountRaw = cells[amountIdx] ?? '';
      amount = parseAmount(amountRaw);
      kind = resolveKind(amountRaw, amount ?? 0, typeValue);
    }

    if (!date || amount == null || amount <= 0) {
      skipped.push({
        date: date ?? '—',
        amount: amount ?? 0,
        kind: 'expense',
        title: description || 'Без описания',
        category: 'Другое',
        externalId: `skip:${i}`,
        skipped: true,
        skipReason: 'Не удалось прочитать дату или сумму',
      });
      continue;
    }

    const title = description || (kind === 'income' ? 'Поступление' : 'Расход');
    const resolvedCategory =
      kind === 'income'
        ? inferIncomeCategory(description, bankCategory, { providerId: resolvedProviderId })
        : inferExpenseCategory(description, bankCategory, { providerId: resolvedProviderId });

    const row: ParsedStatementRow = {
      date,
      amount,
      kind,
      title: title.slice(0, 120),
      category: resolvedCategory,
      note: bankCategory ? `Категория банка: ${bankCategory}` : undefined,
      externalId: buildExternalId({
        providerId: resolvedProviderId,
        date,
        amount,
        kind,
        title,
      }),
    };

    if (isBrokerTransfer(description)) {
      skipped.push({ ...row, skipped: true, skipReason: 'Пополнение брокерского счёта' });
      continue;
    }

    pushParsedRow(parsed, skipped, row);
  }

  if (parsed.length === 0) {
    throw new Error('Не нашли подходящих операций в CSV. Проверьте колонки и формат файла.');
  }

  const expenses = parsed.filter((row) => row.kind === 'expense');
  const income = parsed.filter((row) => row.kind === 'income' && !isParsedPurchaseRefund(row));
  const dates = parsed.map((row) => row.date).sort();

  return {
    format,
    formatLabel: label,
    fileName,
    rows: parsed,
    skipped,
    expenses: expenses.length,
    income: income.length,
    expenseTotal: expenses.reduce((sum, row) => sum + row.amount, 0),
    incomeTotal: income.reduce((sum, row) => sum + row.amount, 0),
    dateFrom: dates[0] ?? null,
    dateTo: dates[dates.length - 1] ?? null,
  };
}

export function toBankStatementImportRows(rows: ParsedStatementRow[]): BankStatementImportRow[] {
  return rows.map((row) => ({
    date: row.date,
    amount: row.amount,
    kind: row.kind,
    title: row.title,
    category: row.category,
    note: row.note,
    externalId: row.externalId,
    cardLast4: row.cardLast4,
  }));
}

/** Сумма в выписке Т‑Банка: «-8 426.00», «-8426.00», с неразрывным пробелом. */
const TBANK_AMOUNT_TOKEN = /[-+−]\s*\d[\d\s\u00a0]*(?:[.,]\d{2})?/u;

const TBANK_MOVEMENT_ROW =
  /^(\d{1,2}\.\d{1,2}\.\d{2,4})\s+\d{1,2}\.\d{1,2}\.\d{2,4}\s+([-+−]\s*\d[\d\s\u00a0]*(?:[.,]\d{2})?)\s*₽\s+[-+−]\s*\d[\d\s\u00a0]*(?:[.,]\d{2})?\s*₽\s+(.+?)(?:\s+(?:(\d{4})|—|-))?$/iu;

/** Одна сумма или разбитая на несколько строк PDF-строка. */
const TBANK_MOVEMENT_ROW_RELAXED =
  /^(\d{1,2}\.\d{1,2}\.\d{2,4})(?:\s+\d{1,2}\.\d{1,2}\.\d{2,4})?\s+([-+−]\s*\d[\d\s\u00a0]*(?:[.,]\d{2})?)\s*₽(?:\s+[-+−]\s*\d[\d\s\u00a0]*(?:[.,]\d{2})?\s*₽)?\s+(.+?)(?:\s+(?:(\d{4})|—|-))?$/iu;

type TbankMovementMatch = {
  date: string;
  amountRaw: string;
  description: string;
  cardLast4?: string;
};

function parseTbankMovementCardSuffix(cardSuffix: string | undefined): string | undefined {
  const digits = cardSuffix?.trim() ?? '';
  return /^\d{4}$/.test(digits) ? digits : undefined;
}

function matchTbankMovementLine(line: string): TbankMovementMatch | null {
  const strict = line.match(TBANK_MOVEMENT_ROW);
  if (strict) {
    return {
      date: strict[1] ?? '',
      amountRaw: strict[2] ?? '',
      description: (strict[3] ?? '').trim(),
      cardLast4: parseTbankMovementCardSuffix(strict[4]),
    };
  }

  const relaxed = line.match(TBANK_MOVEMENT_ROW_RELAXED);
  if (relaxed) {
    return {
      date: relaxed[1] ?? '',
      amountRaw: relaxed[2] ?? '',
      description: (relaxed[3] ?? '').trim(),
      cardLast4: parseTbankMovementCardSuffix(relaxed[4]),
    };
  }

  return null;
}

function isTbankMovementNoiseLine(line: string): boolean {
  return (
    /^дата\s+и\s+время/i.test(line) ||
    /^(?:пополнения|расходы)\s*:/i.test(line) ||
    /^с уважением/i.test(line) ||
    /^страница\s+\d/i.test(line) ||
    /^\d+\s+из\s+\d+$/i.test(line) ||
    isPdfNoiseLine(line)
  );
}

function joinTbankMovementLines(lines: string[], start: number, maxExtra = 2): string {
  const parts = [lines[start] ?? ''];
  for (let offset = 1; offset <= maxExtra; offset += 1) {
    const next = lines[start + offset];
    if (!next || isTbankMovementNoiseLine(next) || /^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(next)) {
      break;
    }
    parts.push(next);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function detectTbankCardKind(text: string): StatementCardKind | undefined {
  const sample = text.slice(0, 6000).toLowerCase();
  if (/кредитн(ая|ый)?\s+(карт|счет|счёт)|кредитный\s+договор|credit\s+card/i.test(sample)) {
    return 'credit';
  }
  if (/дебетов(ая|ый)?\s+(карт|счет|счёт)|дебетовый\s+счет/i.test(sample)) {
    return 'debit';
  }
  return undefined;
}

function collectStatementCardMeta(rows: ParsedStatementRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.cardLast4) continue;
    counts.set(row.cardLast4, (counts.get(row.cardLast4) ?? 0) + 1);
  }
  let cardLast4: string | undefined;
  let max = 0;
  for (const [digits, count] of counts) {
    if (count > max) {
      max = count;
      cardLast4 = digits;
    }
  }
  return cardLast4;
}

function withStatementCardMeta(
  result: StatementParseResult,
  content: string,
  rows: ParsedStatementRow[]
): StatementParseResult {
  return {
    ...result,
    detectedCardKind: detectTbankCardKind(content),
    cardLast4: collectStatementCardMeta(rows),
  };
}

const PDF_TRANSACTION_LINE =
  /^(\d{1,2}[./]\d{1,2}[./]\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\s+([-+−]?\s*\d{1,3}(?:\s\d{3})*(?:[.,]\d{2})?)\s*(?:RUB|₽|руб\.?)?\s*(.*)$/iu;

const PDF_DATE_PATTERN = /\b(\d{1,2}[./]\d{1,2}[./]\d{2,4})\b/;
const PDF_AMOUNT_CAPTURE =
  /([-+−]\s*\d{1,3}(?:\s\d{3})*(?:[.,]\d{2})?|\d{1,3}(?:\s\d{3})*(?:[.,]\d{2})?)(?:\s*(?:₽|RUB|руб\.?|RUR))?/i;
const PDF_AMOUNT_END =
  /(.+?)\s+([-+−]?\d{1,3}(?:\s\d{3})*(?:[.,]\d{2})?)\s*(?:₽|RUB|руб\.?|RUR)?\s*$/iu;

function looksLikeOzonMovementPdf(text: string): boolean {
  return (
    (/ozon\s*банк|оозон\s*банк|ozonbank/i.test(text) ||
      (text.toLowerCase().includes('ozon') && text.includes('Банк'))) &&
    /справка о движении средств/i.test(text)
  );
}

const OZON_TX_HEAD =
  /^(\d{1,2}\.\d{2}\.\d{2,4})\s+(\d{1,2}:\d{2}:\d{2})\s+(\d+)\s*(.*)$/;
const OZON_INLINE_AMOUNT =
  /\s([-+−])\s*([\d\s\u00a0]+[.,]\d{2})\s*₽(?:\s+([-+−])\s*([\d\s\u00a0]+[.,]\d{2})\s*₽)?\s*$/u;
const OZON_STANDALONE_AMOUNT = /^([-+−])\s*([\d\s\u00a0]+[.,]\d{2})\s*₽\s*$/u;

function isBlockTransactionHead(line: string) {
  return OZON_TX_HEAD.test(line.trim());
}

function parseBlockTransactionBlock(
  blockLines: string[],
  providerId?: string
): ParsedStatementRow | null {
  const headLine = blockLines[0]?.trim() ?? '';
  const head = headLine.match(OZON_TX_HEAD);
  if (!head) return null;

  const date = parseDate(head[1] ?? '');
  const time = head[2];
  if (!date) return null;

  let tail = (head[4] ?? '').trim();
  let amountRaw = '';
  const inlineAmount = tail.match(OZON_INLINE_AMOUNT);
  if (inlineAmount) {
    amountRaw = `${inlineAmount[1] ?? ''} ${inlineAmount[2] ?? ''}`.trim();
    tail = tail.slice(0, tail.length - inlineAmount[0].length).trim();
  }

  const descParts = tail ? [tail] : [];

  for (let i = 1; i < blockLines.length; i += 1) {
    const line = blockLines[i]?.trim() ?? '';
    if (!line || /^\d{1,2}$/.test(line)) continue;

    const standaloneAmount = line.match(OZON_STANDALONE_AMOUNT);
    if (standaloneAmount) {
      if (!amountRaw) {
        amountRaw = `${standaloneAmount[1] ?? ''} ${standaloneAmount[2] ?? ''}`.trim();
      }
      continue;
    }

    descParts.push(line);
  }

  const description = descParts.join(' ').replace(/\s+/g, ' ').trim();
  if (!amountRaw || !description) return null;

  return buildRowFromFields({
    date,
    amountRaw,
    description,
    providerId: providerId ?? 'ozon',
    time,
    documentId: head[3],
  });
}

function isMovementNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    !trimmed ||
    /^ооо\s+[«"]?озон/i.test(trimmed) ||
    /^справка о движении/i.test(trimmed) ||
    /^№\s*ф-/i.test(trimmed) ||
    /^владелец:/i.test(trimmed) ||
    /^номер лицевого/i.test(trimmed) ||
    /^дата и время формирования/i.test(trimmed) ||
    /^период выписки/i.test(trimmed) ||
    /^валюта:/i.test(trimmed) ||
    /^входящий остаток|^исходящий остаток/i.test(trimmed) ||
    /^дата операции/i.test(trimmed) ||
    /^документ/i.test(trimmed) ||
    /^назначение платежа/i.test(trimmed) ||
    /^сумма операции/i.test(trimmed) ||
    /^российские рубли/i.test(trimmed) ||
    /^лицензия банка/i.test(trimmed) ||
    /^инн\/кпп/i.test(trimmed) ||
    /^\d{1,2}$/.test(trimmed) ||
    isPdfNoiseLine(trimmed)
  );
}

function parseMovementPdf(
  content: string,
  fileName: string,
  providerId?: string
): StatementParseResult {
  const lines = normalizePdfLines(content).filter((line) => !isMovementNoiseLine(line));
  const { format, label } = detectPdfFormatLabel(providerId);
  const parsed: ParsedStatementRow[] = [];
  const skipped: ParsedStatementRow[] = [];
  const seenExternalIds = new Set<string>();

  const pushUniqueRow = (row: ParsedStatementRow | null) => {
    if (!row || seenExternalIds.has(row.externalId)) return;
    seenExternalIds.add(row.externalId);
    pushParsedRow(parsed, skipped, row);
  };

  const headIndices: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (isBlockTransactionHead(lines[i] ?? '')) headIndices.push(i);
  }

  for (let h = 0; h < headIndices.length; h += 1) {
    const start = headIndices[h] ?? 0;
    const end = headIndices[h + 1] ?? lines.length;
    const block = lines.slice(start, end);
    pushUniqueRow(parseBlockTransactionBlock(block, providerId));
  }

  return finalizeStatementParseResult(parsed, skipped, fileName, format, label);
}

function looksLikeBlockMovementPdf(text: string): boolean {
  const sample = text.slice(0, 25000);
  const hits = (sample.match(/\d{1,2}\.\d{2}\.\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+\d+/g) ?? []).length;
  return (
    hits >= 3 &&
    (/справка о движении/i.test(sample) ||
      /выписка по сч/i.test(sample) ||
      /расшифровка операций/i.test(sample))
  );
}

function parseOzonMovementPdf(
  content: string,
  fileName: string,
  providerId?: string
): StatementParseResult {
  return parseMovementPdf(content, fileName, providerId ?? 'ozon');
}

function looksLikeTbankMovementPdf(text: string): boolean {
  const isTbank = /т-?банк|tinkoff|t-bank|ао\s+[«"]?т[- ]?банк/i.test(text);
  return isTbank && /справка о движении средств/i.test(text);
}

function parseTbankMovementPdf(
  content: string,
  fileName: string,
  providerId?: string
): StatementParseResult {
  const lines = normalizePdfLines(content);
  const { format, label } = detectPdfFormatLabel(providerId);
  const parsed: ParsedStatementRow[] = [];
  const skipped: ParsedStatementRow[] = [];
  const seenExternalIds = new Set<string>();

  const pushUniqueRow = (row: ParsedStatementRow | null) => {
    if (!row || seenExternalIds.has(row.externalId)) return;
    seenExternalIds.add(row.externalId);
    pushParsedRow(parsed, skipped, row);
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isTbankMovementNoiseLine(line)) continue;

    let movement = matchTbankMovementLine(line);
    let consumed = 0;

    if (!movement) {
      for (let extra = 1; extra <= 2; extra += 1) {
        const joined = joinTbankMovementLines(lines, i, extra);
        if (joined === line) continue;
        const joinedMatch = matchTbankMovementLine(joined);
        if (joinedMatch) {
          movement = joinedMatch;
          consumed = extra;
          break;
        }
      }
    }

    if (!movement) continue;

    let description = movement.description;
    if (/^перевод/i.test(description) && description.length < 48) {
      for (let k = i + consumed + 1; k < lines.length && k <= i + consumed + 6; k += 1) {
        const next = lines[k]?.trim() ?? '';
        if (!next || isTbankMovementNoiseLine(next) || matchTbankMovementLine(next)) break;
        if (/^\d{1,2}\.\d{1,2}\.\d{2,4}/.test(next)) break;
        description = `${description} ${next}`.replace(/\s+/g, ' ').trim();
        consumed = k - i;
      }
    }

    const row = buildRowFromFields({
      date: parseDate(movement.date),
      amountRaw: movement.amountRaw,
      description,
      cardLast4: movement.cardLast4,
      providerId,
    });
    pushUniqueRow(row);
    i += consumed;
  }

  return withStatementCardMeta(
    finalizeStatementParseResult(parsed, skipped, fileName, format, label),
    content,
    [...parsed, ...skipped]
  );
}

/** Строка-итог операции в PDF Сбербанка: дата, категория, сумма, остаток. */
const SBER_CC_SUMMARY_ROW =
  /^(\d{1,2}\.\d{1,2}\.\d{2,4})\s+\d{1,2}:\d{2}\s+(.+?)\s+([-+]?\s*\d{1,3}(?:\s\d{3})*,\d{2})\s+\d{1,3}(?:\s\d{3})*,\d{2}\s*$/u;

/** Строка с мерчантом: дата обработки, код авторизации, описание. */
const SBER_CC_DETAIL_ROW = /^(\d{1,2}\.\d{1,2}\.\d{2,4})\s+(\d{4,8})\s+(.+)$/u;

function looksLikeSberCreditCardPdf(text: string): boolean {
  return /выписка по счёту кредитной карты/i.test(text) && /остаток средств/i.test(text);
}

function isSberCreditCardNoiseLine(line: string): boolean {
  return (
    /^выписка по счёту/i.test(line) ||
    /^за период/i.test(line) ||
    /^итого по операциям/i.test(line) ||
    /^владелец счёта/i.test(line) ||
    /^номер счёта/i.test(line) ||
    /^карта\s+/i.test(line) ||
    /^валюта\s+/i.test(line) ||
    /^кредитный лимит/i.test(line) ||
    /^процентная ставка/i.test(line) ||
    /^льготный период/i.test(line) ||
    /^общая задолженность/i.test(line) ||
    /^дата открытия/i.test(line) ||
    /^дата закрытия/i.test(line) ||
    /^расшифровка операций/i.test(line) ||
    /^дата операции/i.test(line) ||
    /^дата обработки/i.test(line) ||
    /^и код авторизации/i.test(line) ||
    /^продолжение на следующей/i.test(line) ||
    /^для проверки подлинности/i.test(line) ||
    /^действителен/i.test(line) ||
    /^остаток на\s/i.test(line) ||
    /^пополнение\s/i.test(line) ||
    /^списание\s/i.test(line) ||
    /^с учётом списаний/i.test(line) ||
    /^погашение процентов/i.test(line) ||
    /^страница\s+\d/i.test(line) ||
    /^\d+\s+из\s+\d+$/i.test(line) ||
    /^\*{4}\d{4}$/.test(line) ||
    isPdfNoiseLine(line)
  );
}

function cleanSberMerchantDescription(text: string): string {
  return text
    .replace(/\.\s*Операция по карте.*$/i, '')
    .replace(/\s*Операция по карте.*$/i, '')
    .replace(/\s*\*{4}\d{4}\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSberCreditCardPdf(
  content: string,
  fileName: string,
  providerId?: string
): StatementParseResult {
  const lines = normalizePdfLines(content);
  const { format, label } = detectPdfFormatLabel(providerId);
  const parsed: ParsedStatementRow[] = [];
  const skipped: ParsedStatementRow[] = [];
  const seenExternalIds = new Set<string>();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isSberCreditCardNoiseLine(line)) continue;

    const summary = line.match(SBER_CC_SUMMARY_ROW);
    if (!summary) continue;

    const date = parseDate(summary[1] ?? '');
    const bankCategory = (summary[2] ?? '').trim();
    const amountRaw = summary[3] ?? '';
    if (!date || !bankCategory) continue;

    let merchant = '';
    let cardLast4: string | undefined;
    let j = i + 1;
    while (j < lines.length && j < i + 8) {
      const next = lines[j] ?? '';
      if (SBER_CC_SUMMARY_ROW.test(next)) break;
      if (isSberCreditCardNoiseLine(next)) {
        j += 1;
        continue;
      }

      const cardMatch = next.match(/\*{4}(\d{4})/);
      if (cardMatch?.[1]) cardLast4 = cardMatch[1];

      const detail = next.match(SBER_CC_DETAIL_ROW);
      if (detail?.[3]) {
        const cleaned = cleanSberMerchantDescription(detail[3]);
        if (cleaned) merchant = cleaned;
      }
      j += 1;
    }

    const title = (merchant || bankCategory).slice(0, 120);
    const row = buildRowFromFields({
      date,
      amountRaw,
      description: title,
      cardLast4,
      providerId,
    });
    if (!row || seenExternalIds.has(row.externalId)) continue;

    seenExternalIds.add(row.externalId);
    row.category = inferExpenseCategory(title, bankCategory, { providerId });
    row.title = title;
    row.note = [row.note, `Категория банка: ${bankCategory}`].filter(Boolean).join(' · ');
    if (resolveInternalTransfer(title, bankCategory)) {
      row.internalTransfer = true;
    }
    pushParsedRow(parsed, skipped, row);
  }

  return withStatementCardMeta(
    finalizeStatementParseResult(parsed, skipped, fileName, format, label),
    content,
    [...parsed, ...skipped]
  );
}

function looksLikePdfStatement(text: string): boolean {
  const head = text.slice(0, 8000).toLowerCase();
  return (
    /^%pdf-\d/m.test(text.slice(0, 20)) ||
    /справка о движении/i.test(head) ||
    /выписка по сч/i.test(head) ||
    /расшифровка операций/i.test(head) ||
    /лицензия банка россии/i.test(head) ||
    /движение средств за период/i.test(head)
  );
}

function looksLikeCsv(text: string): boolean {
  if (looksLikePdfStatement(text)) return false;

  const sample = text.slice(0, 4000).toLowerCase();
  if (!/дата|date/.test(sample) || !/сумма|amount|debit|credit|расход|поступ/.test(sample)) {
    return false;
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 25);
  let structuredRows = 0;
  for (const line of lines) {
    const delimiterCount = Math.max(line.match(/;/g)?.length ?? 0, line.match(/,/g)?.length ?? 0);
    if (delimiterCount >= 2) structuredRows += 1;
  }

  return structuredRows >= 2 && (sample.includes(';') || sample.includes(','));
}

function normalizePdfLines(content: string): string[] {
  return content
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.replace(/\u00a0/g, ' ').trim())
    .filter(Boolean);
}

function isPdfMetadataDescription(text: string): boolean {
  const lower = text.toLowerCase();
  return /адрес\s+(места\s+)?жительства|место\s+жительства|дата\s+рождения|паспорт|снилс|инн\s*:|огрн|огрнип|дата\s+заключения|номер\s+договора|лицевой\s+счет|исх\.?\s*№|договор\s+банковского|счет\s*№|р\/с\s*|к\/с\s*|бик\s*\d|волгоград|обл\.|край,|респ\.|^\d{6},/i.test(
    lower
  );
}

function sanitizeMerchantTitle(text: string): string {
  let title = text.trim();
  const paymentMatch = title.match(/оплата в\s+(.+)/i);
  if (paymentMatch) {
    title = paymentMatch[1].trim();
  }
  title = title.split(/адрес\s+(места\s+)?жительства/i)[0] ?? title;
  title = title.split(/дата\s+заключения/i)[0] ?? title;
  title = title.split(/номер\s+договора/i)[0] ?? title;
  title = title
    .replace(/^(исх\.?\s*№[^\s]*\s*)/i, '')
    .replace(/^(дата\s+[^\s]+\s*)/i, '')
    .replace(/\bRUS\b/gi, '')
    .replace(/\b\d{6},\s*[\p{L}\s.,-]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
  return title.slice(0, 120);
}

function isPdfNoiseLine(line: string): boolean {
  if (line.length < 2) return true;
  return /^(итого|баланс|выписка|справка|остаток|входящ|исходящ|дата\s+операции|дата\s+проведения|сумма\s+в\s+валюте|сумма\s+операции|описание\s+операции|назначение\s+платежа|валюта\s+операции|тип\s+операции|категория|страница|page|\d+\s+из\s+\d+|лицевой\s+счет|номер\s+карты|движение\s+средств|выписка\s+по\s+счету|клиент|бик|инн|к\/с|р\/с|счёт|счет|тариф|договор|адрес\s+места|место\s+жительства|дата\s+рождения|паспорт|исх\.?\s*№)/i.test(
    line
  );
}

function cleanPdfDescription(text: string): string {
  return text
    .replace(PDF_AMOUNT_CAPTURE, ' ')
    .replace(PDF_DATE_PATTERN, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
    .replace(/\b(?:RUB|RUR|₽|руб\.?)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWeakGenericDescription(description: string): boolean {
  const trimmed = description.trim();
  if (trimmed.length < 4) return true;
  if (/^(итого|баланс|остаток|валюта|страница|\d+\s+из\s+\d+)$/i.test(trimmed)) return true;
  if (/^\d+$/.test(trimmed)) return true;
  return isPdfMetadataDescription(trimmed);
}

function isSuspiciousGenericResult(result: StatementParseResult): boolean {
  if (result.format !== 'generic' || result.rows.length === 0) return false;
  const weak = result.rows.filter(
    (row) => row.title.length < 4 || isPdfMetadataDescription(row.title)
  ).length;
  return weak > result.rows.length * 0.4;
}

function extractAmountAndDescription(text: string): { amountRaw: string; description: string } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const endMatch = trimmed.match(PDF_AMOUNT_END);
  if (endMatch) {
    const description = cleanPdfDescription(endMatch[1] ?? '');
    if (description.length >= 2) {
      return { amountRaw: endMatch[2] ?? '', description };
    }
  }

  const amountMatch = trimmed.match(PDF_AMOUNT_CAPTURE);
  if (!amountMatch) return null;

  const amountRaw = amountMatch[1] ?? '';
  const description = cleanPdfDescription(trimmed.replace(amountMatch[0], ' '));
  if (description.length < 2) return null;

  return { amountRaw, description };
}

function resolveKindFromPdfContext(
  amountRaw: string,
  amount: number,
  description: string,
  typeValue?: string
): TransactionKind {
  const kind = resolveKind(amountRaw, amount, typeValue);
  if (kind === 'income') return 'income';

  const desc = description.toLowerCase();
  if (
    /зачисл|поступлен|возврат|зарплат|заработная\s+плата|оплата\s+труда|оплата\s+за\s+разработку|cashback|кэшбэк|проценты|дивиденд/.test(
      desc
    ) &&
    !isBrokerTransfer(description)
  ) {
    return 'income';
  }
  return kind;
}

function buildRowFromFields(input: {
  date: string | null;
  amountRaw: string;
  description: string;
  providerId?: string;
  typeValue?: string;
  time?: string;
  cardLast4?: string;
  documentId?: string;
}): ParsedStatementRow | null {
  const { date, amountRaw, description, providerId, typeValue, time, cardLast4, documentId } =
    input;
  const amount = parseAmount(amountRaw);
  if (!date || amount == null || amount <= 0) return null;

  const cleanedDescription = sanitizeMerchantTitle(cleanPdfDescription(description));
  if (!cleanedDescription || isPdfMetadataDescription(cleanedDescription)) return null;

  const kind = resolveKindFromPdfContext(amountRaw, amount, cleanedDescription, typeValue);
  const title = cleanedDescription || (kind === 'income' ? 'Поступление' : 'Расход');
  const guessed =
    kind === 'income'
      ? inferIncomeCategory(cleanedDescription, undefined, { providerId })
      : inferExpenseCategory(cleanedDescription, undefined, { providerId });
  let resolvedCategory = guessed;

  const noteParts = [
    time ? `Время: ${time}` : null,
    cardLast4 ? `Карта ···${cardLast4}` : null,
  ].filter(Boolean);

  const draftRow = {
    kind,
    category: resolvedCategory,
    title: title.slice(0, 120),
    note: noteParts.length > 0 ? noteParts.join(' · ') : undefined,
  };
  if (isPurchaseRefund(draftRow)) {
    resolvedCategory = 'Возврат';
  }

  return {
    date,
    amount,
    kind,
    title: title.slice(0, 120),
    category: resolvedCategory,
    note: noteParts.length > 0 ? noteParts.join(' · ') : undefined,
    cardLast4,
    externalId: buildExternalId({
      providerId,
      date,
      amount,
      kind,
      title,
      cardLast4,
      time,
      documentId,
    }),
    skipped: false,
    skipReason: undefined,
  };
}

function pushParsedRow(
  parsed: ParsedStatementRow[],
  skipped: ParsedStatementRow[],
  row: ParsedStatementRow
) {
  if (isBrokerTransfer(row.title)) {
    skipped.push({ ...row, skipped: true, skipReason: 'Пополнение брокерского счёта' });
    return;
  }

  parsed.push(row);
}

function enrichParseResult(result: StatementParseResult, content: string): StatementParseResult {
  const accountOwner = extractStatementAccountOwner(content);
  const seenExternalIds = new Set<string>();
  const rows: ParsedStatementRow[] = [];

  for (const row of result.rows) {
    const flagged = applyOwnFundsFlags(row, accountOwner);
    if (seenExternalIds.has(flagged.externalId)) continue;
    seenExternalIds.add(flagged.externalId);
    rows.push(flagged);
  }

  return {
    ...result,
    rows,
    accountOwner,
    expenses: rows.filter((row) => row.kind === 'expense').length,
    income: rows.filter((row) => row.kind === 'income' && !isParsedPurchaseRefund(row)).length,
    expenseTotal: rows
      .filter((row) => row.kind === 'expense')
      .reduce((sum, row) => sum + row.amount, 0),
    incomeTotal: rows
      .filter((row) => row.kind === 'income' && !isParsedPurchaseRefund(row))
      .reduce((sum, row) => sum + row.amount, 0),
  };
}

function parseBankStatementPdfBlocks(
  content: string,
  fileName: string,
  providerId?: string
): StatementParseResult {
  const lines = normalizePdfLines(content);
  const { format, label } = detectPdfFormatLabel(providerId);
  const parsed: ParsedStatementRow[] = [];
  const skipped: ParsedStatementRow[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isPdfNoiseLine(line)) continue;

    const dateMatch = line.match(PDF_DATE_PATTERN);
    if (!dateMatch) continue;

    const date = parseDate(dateMatch[1] ?? '');
    if (!date) continue;

    const blockLines: string[] = [line];
    let j = i + 1;
    while (j < lines.length && j < i + 10) {
      const next = lines[j];
      if (isPdfNoiseLine(next)) {
        j += 1;
        continue;
      }
      if (PDF_DATE_PATTERN.test(next) && !/^\d{1,2}:\d{2}/.test(next)) break;
      blockLines.push(next);
      j += 1;
    }

    const blockText = blockLines.join(' ');
    let payload = blockText.replace(PDF_DATE_PATTERN, ' ').trim();
    const inlineTime = blockText.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
    if (inlineTime) {
      payload = payload.replace(inlineTime[0], ' ').trim();
    }

    const extracted = extractAmountAndDescription(payload);
    if (!extracted) {
      i = j > i + 1 ? j - 1 : i;
      continue;
    }

    const row = buildRowFromFields({
      date,
      amountRaw: extracted.amountRaw,
      description: extracted.description,
      providerId,
    });

    if (row) {
      pushParsedRow(parsed, skipped, row);
    }

    i = j > i + 1 ? j - 1 : i;
  }

  return finalizeStatementParseResult(parsed, skipped, fileName, format, label);
}

function parseBankStatementPdfSpacedRows(
  content: string,
  fileName: string,
  providerId?: string
): StatementParseResult {
  const lines = normalizePdfLines(content);
  const { format, label } = detectPdfFormatLabel(providerId);
  const parsed: ParsedStatementRow[] = [];
  const skipped: ParsedStatementRow[] = [];

  for (const line of lines) {
    if (isPdfNoiseLine(line) || !PDF_DATE_PATTERN.test(line)) continue;

    const parts = line
      .split(/\s{2,}|\t+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (parts.length < 2) continue;

    const date = parseDate(parts[0] ?? '');
    if (!date) continue;

    let amountRaw = '';
    let description = '';
    let typeValue: string | undefined;

    for (let idx = 1; idx < parts.length; idx += 1) {
      const part = parts[idx] ?? '';
      if (!amountRaw && PDF_AMOUNT_CAPTURE.test(part)) {
        amountRaw = part;
        continue;
      }
      if (/^(дебет|кредит|расход|доход|списание|зачисление)$/i.test(part)) {
        typeValue = part;
        continue;
      }
      if (!/^\d{1,2}:\d{2}(?::\d{2})?$/.test(part) && !/^(RUB|RUR|₽|руб\.?)$/i.test(part)) {
        description = description ? `${description} ${part}` : part;
      }
    }

    if (!amountRaw) {
      const extracted = extractAmountAndDescription(parts.slice(1).join(' '));
      if (!extracted) continue;
      amountRaw = extracted.amountRaw;
      description = extracted.description;
    }

    const row = buildRowFromFields({
      date,
      amountRaw,
      description: cleanPdfDescription(description),
      providerId,
      typeValue,
    });
    if (row) pushParsedRow(parsed, skipped, row);
  }

  return finalizeStatementParseResult(parsed, skipped, fileName, format, label);
}

const PDF_INLINE_TRANSACTION =
  /\b(\d{1,2}[./]\d{1,2}[./]\d{2,4})\b(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\s+([-+−]?\s*\d{1,3}(?:\s\d{3})*(?:[.,]\d{2})?)(?:\s*(?:₽|RUB|руб\.?|RUR))?/giu;

function parseBankStatementPdfInlineScan(
  content: string,
  fileName: string,
  providerId?: string
): StatementParseResult {
  const flat = content.replace(/\s+/g, ' ').trim();
  const { format, label } = detectPdfFormatLabel(providerId);
  const parsed: ParsedStatementRow[] = [];
  const skipped: ParsedStatementRow[] = [];

  const matches = [...flat.matchAll(PDF_INLINE_TRANSACTION)];
  if (matches.length === 0) {
    return finalizeStatementParseResult(parsed, skipped, fileName, format, label);
  }

  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const date = parseDate(match[1] ?? '');
    const amountRaw = match[2] ?? '';
    if (!date) continue;

    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? flat.length) : flat.length;
    const description = cleanPdfDescription(flat.slice(start, end));
    if (isWeakGenericDescription(description)) continue;

    const row = buildRowFromFields({
      date,
      amountRaw,
      description,
      providerId,
    });
    if (row) pushParsedRow(parsed, skipped, row);
  }

  return finalizeStatementParseResult(parsed, skipped, fileName, format, label);
}

function detectPdfFormatLabel(providerId?: string): { format: StatementBankFormat; label: string } {
  if (providerId === 'tbank') {
    return { format: 'tbank', label: `PDF · ${BANK_STATEMENT_PROVIDER_LABELS.tbank}` };
  }
  if (providerId === 'sber') {
    return { format: 'sber', label: `PDF · ${BANK_STATEMENT_PROVIDER_LABELS.sber}` };
  }
  if (providerId === 'ozon') {
    return { format: 'ozon', label: `PDF · ${BANK_STATEMENT_PROVIDER_LABELS.ozon}` };
  }
  const providerLabel = providerFormatLabel(providerId);
  return {
    format: 'generic',
    label: providerLabel ? `PDF · ${providerLabel}` : 'PDF · универсальный',
  };
}

function finalizeStatementParseResult(
  parsed: ParsedStatementRow[],
  skipped: ParsedStatementRow[],
  fileName: string,
  format: StatementBankFormat,
  formatLabel: string
): StatementParseResult {
  if (parsed.length === 0) {
    throw new Error(
      'Не нашли операций в PDF. Скачайте выписку в CSV из личного кабинета банка — формат надёжнее.'
    );
  }

  const expenses = parsed.filter((row) => row.kind === 'expense');
  const income = parsed.filter((row) => row.kind === 'income' && !isParsedPurchaseRefund(row));
  const dates = parsed.map((row) => row.date).sort();

  return {
    format,
    formatLabel,
    fileName,
    rows: parsed,
    skipped,
    expenses: expenses.length,
    income: income.length,
    expenseTotal: expenses.reduce((sum, row) => sum + row.amount, 0),
    incomeTotal: income.reduce((sum, row) => sum + row.amount, 0),
    dateFrom: dates[0] ?? null,
    dateTo: dates[dates.length - 1] ?? null,
  };
}

function parseBankStatementPdfLines(
  content: string,
  fileName: string,
  providerId?: string
): StatementParseResult {
  const lines = normalizePdfLines(content);
  const { format, label } = detectPdfFormatLabel(providerId);
  const parsed: ParsedStatementRow[] = [];
  const skipped: ParsedStatementRow[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (isPdfNoiseLine(line)) continue;

    if (line.includes(';') && PDF_DATE_PATTERN.test(line)) {
      const cells = line.split(';').map((cell) => cell.trim());
      if (cells.length >= 3) {
        const row = buildRowFromFields({
          date: parseDate(cells[0] ?? ''),
          amountRaw: cells[1] ?? '',
          description: cells.slice(2).join(' '),
          providerId,
        });
        if (row) pushParsedRow(parsed, skipped, row);
      }
      continue;
    }

    const match = line.match(PDF_TRANSACTION_LINE);
    if (!match) continue;

    let description = (match[3] ?? '').trim();
    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (PDF_TRANSACTION_LINE.test(next) || isPdfNoiseLine(next)) break;
      if (PDF_DATE_PATTERN.test(next) && /\d[.,]\d{2}/.test(next)) break;
      i += 1;
      description = description ? `${description} ${lines[i]}` : lines[i];
    }

    const row = buildRowFromFields({
      date: parseDate(match[1] ?? ''),
      amountRaw: match[2] ?? '',
      description,
      providerId,
    });

    if (!row) {
      skipped.push({
        date: parseDate(match[1] ?? '') ?? '—',
        amount: parseAmount(match[2] ?? '') ?? 0,
        kind: 'expense',
        title: description || 'Без описания',
        category: 'Другое',
        externalId: `skip:${i}`,
        skipped: true,
        skipReason: 'Не удалось прочитать дату или сумму',
      });
      continue;
    }

    pushParsedRow(parsed, skipped, row);
  }

  return finalizeStatementParseResult(parsed, skipped, fileName, format, label);
}

export function parseBankStatementText(
  content: string,
  fileName: string,
  providerId?: string
): StatementParseResult {
  const trimmed = content.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    throw new Error('Файл пустой.');
  }

  const resolvedProviderId = providerId ?? detectBankFromPdfText(trimmed) ?? undefined;

  const attempts: Array<() => StatementParseResult> = [
    ...(looksLikeCsv(trimmed)
      ? [() => parseBankStatementCsv(trimmed, fileName, resolvedProviderId)]
      : []),
    ...(looksLikeSberCreditCardPdf(trimmed)
      ? [() => parseSberCreditCardPdf(trimmed, fileName, resolvedProviderId)]
      : []),
    ...(looksLikeOzonMovementPdf(trimmed)
      ? [() => parseOzonMovementPdf(trimmed, fileName, resolvedProviderId)]
      : []),
    ...(looksLikeTbankMovementPdf(trimmed)
      ? [() => parseTbankMovementPdf(trimmed, fileName, resolvedProviderId)]
      : []),
    ...(looksLikeBlockMovementPdf(trimmed)
      ? [() => parseMovementPdf(trimmed, fileName, resolvedProviderId)]
      : []),
    () => parseBankStatementPdfBlocks(trimmed, fileName, resolvedProviderId),
    () => parseBankStatementPdfSpacedRows(trimmed, fileName, resolvedProviderId),
    () => parseBankStatementPdfLines(trimmed, fileName, resolvedProviderId),
    () => parseBankStatementPdfInlineScan(trimmed, fileName, resolvedProviderId),
  ];

  let lastError: Error | null = null;
  for (const attempt of attempts) {
    try {
      const raw = attempt();
      if (isSuspiciousGenericResult(raw)) {
        lastError = new Error('Слишком много нечитаемых строк в универсальном парсере');
        continue;
      }
      return enrichParseResult(raw, trimmed);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Не удалось разобрать выписку');
    }
  }

  const providerLabel = providerFormatLabel(resolvedProviderId) ?? 'банка';
  throw (
    lastError ??
    new Error(
      `Не удалось извлечь операции из PDF (${providerLabel}). Скачайте выписку в формате CSV — он надёжнее.`
    )
  );
}
