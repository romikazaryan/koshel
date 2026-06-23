/** Банки, для которых поддерживаем импорт выписки CSV/PDF. */
export const BANK_STATEMENT_PROVIDER_IDS = [
  'tbank',
  'sber',
  'vtb',
  'alfa',
  'raiffeisen',
  'gazprombank',
  'ozon',
  'psb',
  'yandex',
  'sovcombank',
  'rosbank',
] as const;

export type BankStatementProviderId = (typeof BANK_STATEMENT_PROVIDER_IDS)[number];

export const BANK_STATEMENT_PROVIDER_LABELS: Record<BankStatementProviderId, string> = {
  tbank: 'Т‑Банк',
  sber: 'Сбербанк',
  vtb: 'ВТБ',
  alfa: 'Альфа-Банк',
  raiffeisen: 'Райффайзенбанк',
  gazprombank: 'Газпромбанк',
  ozon: 'Ozon Банк',
  psb: 'ПСБ',
  yandex: 'Яндекс Банк',
  sovcombank: 'Совкомбанк',
  rosbank: 'Росбанк',
};

const FILE_NAME_PATTERNS: Record<BankStatementProviderId, RegExp> = {
  sber: /сбер|sber/i,
  tbank: /tinkoff|t-?bank|tbank|т-?банк|тинькофф/i,
  vtb: /втб|vtb/i,
  alfa: /альфа|alfa/i,
  raiffeisen: /raiff|райф/i,
  gazprombank: /газпром|gazprom/i,
  ozon: /ozon|озон/i,
  psb: /psb|псб|промсвяз/i,
  yandex: /yandex|яндекс/i,
  sovcombank: /совком|sovcom/i,
  rosbank: /rosbank|росбанк/i,
};

const CSV_HEADER_PATTERNS: Record<BankStatementProviderId, RegExp[]> = {
  tbank: [/тинькофф|t-?bank|tinkoff/i],
  sber: [/сбер|sber/i],
  vtb: [/втб|vtb/i, /банк\s+втб/i],
  alfa: [/альфа|alfa/i],
  raiffeisen: [/raiff|райф/i],
  gazprombank: [/газпром|gazprom/i],
  ozon: [/ozon|озон/i],
  psb: [/псб|psb|промсвяз/i],
  yandex: [/яндекс|yandex/i],
  sovcombank: [/совком|sovcom/i],
  rosbank: [/rosbank|росбанк/i],
};

const PDF_TEXT_PATTERNS: Record<BankStatementProviderId, RegExp[]> = {
  tbank: [/справка о движении средств/i, /т-?банк|t-?bank|tinkoff/i],
  sber: [/выписка по счёту/i, /сбер/i],
  vtb: [/банк\s+втб|втб\s*\(пao\)/i, /справка.*движен/i],
  alfa: [/альфа-банк|ao «альфа/i, /движени.*средств/i],
  raiffeisen: [/raiffeisen|райффайзен/i],
  gazprombank: [/газпромбанк|gazprombank/i],
  ozon: [/ozon\s*банк|ozon bank|оозон\s*банк|ozonbank/i, /справка о движении средств/i],
  psb: [/псб|промсвязьбанк/i],
  yandex: [/яндекс\s*банк|yandex\s*bank/i],
  sovcombank: [/совкомбанк|sovcombank/i],
  rosbank: [/росбанк|rosbank/i],
};

export function isBankStatementProviderId(id: string): id is BankStatementProviderId {
  return (BANK_STATEMENT_PROVIDER_IDS as readonly string[]).includes(id);
}

export function getBankStatementProviderLabel(providerId: string): string | undefined {
  if (!isBankStatementProviderId(providerId)) return undefined;
  return BANK_STATEMENT_PROVIDER_LABELS[providerId];
}

export function detectBankFromFileName(fileName: string): BankStatementProviderId | null {
  const lower = fileName.toLowerCase();
  for (const id of BANK_STATEMENT_PROVIDER_IDS) {
    if (FILE_NAME_PATTERNS[id].test(lower)) return id;
  }
  return null;
}

export function detectBankFromCsvHeaders(headers: string[]): BankStatementProviderId | null {
  const joined = headers.join(' ');
  for (const id of BANK_STATEMENT_PROVIDER_IDS) {
    if (CSV_HEADER_PATTERNS[id].some((pattern) => pattern.test(joined))) return id;
  }
  return null;
}

export function detectBankFromPdfText(text: string): BankStatementProviderId | null {
  const sample = text.slice(0, 8000);
  for (const id of BANK_STATEMENT_PROVIDER_IDS) {
    if (PDF_TEXT_PATTERNS[id].some((pattern) => pattern.test(sample))) return id;
  }
  return null;
}
