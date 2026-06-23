import { detectStatementFileKind } from './bankStatementFile';
import { detectBankFromFileName } from '../constants/bankStatementProviders';
import type { StatementCardKind } from './bankStatementImport';

export type SharedStatementFile = {
  uri: string;
  fileName: string;
  mimeType?: string | null;
  providerId?: string;
  providerName?: string;
  initialAccountKind?: StatementCardKind;
};

export function isSharedStatementFile(fileName: string, mimeType?: string | null): boolean {
  try {
    detectStatementFileKind(fileName, mimeType);
    return true;
  } catch {
    return false;
  }
}

export { detectBankFromFileName } from '../constants/bankStatementProviders';

export function detectAccountKindFromFileName(fileName: string): StatementCardKind | undefined {
  const lower = fileName.toLowerCase();
  if (/кредитн|credit/.test(lower)) return 'credit';
  if (/дебет|debit/.test(lower)) return 'debit';
  return undefined;
}
