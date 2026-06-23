export type StatementCardKind = 'debit' | 'credit';

export type StatementImportRowLike = {
  title: string;
  category: string;
  note?: string;
  kind: 'expense' | 'income';
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

const BANK_TRANSFER_CATEGORY =
  /^(перевод на карту|переводы|перевод между счетами|перевод между своими|погашение|погашение задолженности|пополнение счёта|пополнение счета)$/i;

function rowImportText(row: Pick<StatementImportRowLike, 'title' | 'category' | 'note'>) {
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

function extractSbpRecipient(description: string): string | null {
  const match = description.match(/получатель:\s*(.+?)(?:\.|без\s+ндс|$)/i);
  return match?.[1]?.trim() ?? null;
}

function isOwnFundsMovement(text: string, accountOwner?: string | null): boolean {
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
  accountKind: StatementCardKind | 'checking' | 'debit',
  accountOwner?: string | null
): boolean {
  const cardKind: StatementCardKind = accountKind === 'credit' ? 'credit' : 'debit';
  const text = rowImportText(row);
  const bankCategory = bankCategoryFromNote(row.note);
  if (bankCategory && BANK_TRANSFER_CATEGORY.test(bankCategory)) return true;
  if (row.internalTransfer === true) return true;
  if (cardKind === 'credit') {
    return isCreditCardPayment(text);
  }
  return isOwnFundsMovement(text, accountOwner);
}
