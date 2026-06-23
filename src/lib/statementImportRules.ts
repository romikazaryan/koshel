import type { TransactionKind } from '../types';

export type StatementCardKind = 'debit' | 'credit';

export type StatementImportRowLike = {
  title: string;
  category: string;
  note?: string;
  kind: TransactionKind;
  internalTransfer?: boolean;
};

const INTERNAL_TRANSFER_KEYWORDS = [
  'перевод между счетами',
  'перевод на свой',
  'перевод себе',
  'перевод собственных',
  'перевод собственных средств',
  'перевод клиенту банка',
  'перевод на накопительн',
  'перевод с накопительн',
];

const CREDIT_PAYMENT_KEYWORDS = [
  'перевод себе',
  'перевод на свой',
  'перевод на карту',
  'погашение кредит',
  'оплата кредитной',
  'погашение задолжен',
  'оплата задолжен',
  'перевод для погашения',
  'перевод на счёт',
  'перевод на счет',
  'перевод между своими',
];

export const BANK_TRANSFER_CATEGORY =
  /^(перевод на карту|переводы|перевод между счетами|перевод между своими|погашение|погашение задолженности|пополнение счёта|пополнение счета)$/i;

export type StableExternalIdInput = {
  providerId?: string;
  date: string;
  amount: number;
  kind: TransactionKind;
  cardLast4?: string;
  time?: string;
  documentId?: string;
  /** Используется только если нет time/documentId — защита от коллизий в CSV. */
  titleFallback?: string;
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function buildStableExternalId(input: StableExternalIdInput): string {
  const prefix = input.providerId ? `stmt:${input.providerId}` : 'stmt';
  const hasStableRef = Boolean(input.time?.trim() || input.documentId?.trim());
  const identity = [
    input.date,
    input.time?.trim() ?? '',
    input.documentId?.trim() ?? '',
    input.kind,
    input.amount.toFixed(2),
    input.cardLast4?.trim() ?? '',
    hasStableRef ? '' : (input.titleFallback?.trim().toLowerCase().slice(0, 80) ?? ''),
  ].join('|');
  return `${prefix}:${hashString(`${prefix}|${identity}`)}`;
}

export function rowImportText(row: Pick<StatementImportRowLike, 'title' | 'category' | 'note'>) {
  return `${row.title} ${row.category} ${row.note ?? ''}`.toLowerCase();
}

function isInternalTransfer(description: string) {
  const lower = description.toLowerCase();
  return INTERNAL_TRANSFER_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function isCreditCardPayment(description: string) {
  const lower = description.toLowerCase();
  return CREDIT_PAYMENT_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function normalizePersonNameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\./g, ' ')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
}

function isSamePerson(accountOwner: string, recipient: string): boolean {
  const ownerTokens = normalizePersonNameTokens(accountOwner);
  const recipientTokens = normalizePersonNameTokens(recipient);
  if (ownerTokens.length === 0 || recipientTokens.length === 0) return false;
  const recipientSet = new Set(recipientTokens);
  let matches = 0;
  for (const token of ownerTokens) {
    if (recipientSet.has(token)) matches += 1;
  }
  return matches >= 2;
}

export function extractStatementAccountOwner(content: string): string | null {
  const patterns = [
    /владелец(?:\s+счёта|\s+счета)?:\s*(.+?)(?:\n|$)/i,
    /владелец:\s*(.+?)(?:\n|$)/i,
    /клиент:\s*(.+?)(?:\n|$)/i,
    /ф\.?\s*и\.?\s*о\.?\s*(?:клиента|владельца)?[:\s]+(.+?)(?:\n|$)/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    const name = match?.[1]?.trim();
    if (name && name.length >= 5) return name;
  }
  return null;
}

function extractSbpRecipient(description: string): string | null {
  const match = description.match(/получатель:\s*(.+?)(?:\.|без\s+ндс|$)/i);
  return match?.[1]?.trim() ?? null;
}

/** Переводы между своими счетами, погашение кредитки, СБП на себя. */
export function isOwnFundsMovement(text: string, accountOwner?: string | null): boolean {
  const lower = text.toLowerCase();
  if (/перевод\s+собственных\s+средств/i.test(lower)) return true;
  if (/перевод\s+клиенту\s+банка/i.test(lower)) return true;
  if (isInternalTransfer(lower) || isCreditCardPayment(lower)) return true;
  if (/через\s+сбп/i.test(lower) && accountOwner) {
    const recipient = extractSbpRecipient(lower);
    if (recipient && isSamePerson(accountOwner, recipient)) return true;
  }
  return false;
}

function bankCategoryFromNote(note?: string): string | undefined {
  return note
    ?.split(' · ')
    .map((part) => part.match(/^категория банка:\s*(.+)$/i)?.[1]?.trim())
    .find(Boolean);
}

export function shouldExcludeStatementRow(
  row: StatementImportRowLike,
  cardKind: StatementCardKind,
  accountOwner?: string | null
): boolean {
  const text = rowImportText(row);
  const bankCategory = bankCategoryFromNote(row.note);
  if (bankCategory && BANK_TRANSFER_CATEGORY.test(bankCategory)) return true;
  if (row.internalTransfer === true) return true;
  if (cardKind === 'credit') {
    return isCreditCardPayment(text);
  }
  return isOwnFundsMovement(text, accountOwner);
}

export function applyOwnFundsFlags<T extends StatementImportRowLike>(
  row: T,
  accountOwner?: string | null
): T {
  if (row.internalTransfer === true) return row;
  const text = rowImportText(row);
  if (isOwnFundsMovement(text, accountOwner)) {
    return { ...row, internalTransfer: true };
  }
  return row;
}

export function resolveInternalTransfer(description: string, bankCategory?: string): boolean {
  const combined = `${description} ${bankCategory ?? ''}`.trim();
  if (!combined) return false;
  if (BANK_TRANSFER_CATEGORY.test(bankCategory?.trim() ?? '')) return true;
  return isOwnFundsMovement(combined);
}
