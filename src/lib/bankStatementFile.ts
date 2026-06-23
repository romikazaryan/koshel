import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { requestBankStatementPdfText } from './financialConnections';
import { withTimeout } from './asyncUtils';
import {
  parseBankStatementText,
  type StatementParseResult,
} from './bankStatementImport';

export type StatementFileKind = 'csv' | 'pdf';

const CSV_MIME_TYPES = new Set([
  'text/csv',
  'text/comma-separated-values',
  'application/vnd.ms-excel',
  'text/plain',
  'application/csv',
]);

export function detectStatementFileKind(
  fileName: string,
  mimeType?: string | null
): StatementFileKind {
  const lowerName = fileName.toLowerCase();
  const ext = lowerName.includes('.') ? (lowerName.split('.').pop() ?? '') : '';

  if (ext === 'pdf' || mimeType === 'application/pdf') return 'pdf';
  if (ext === 'csv' || (mimeType && CSV_MIME_TYPES.has(mimeType))) return 'csv';

  throw new Error(
    ext
      ? `Поддерживаются CSV и PDF. Вы выбрали .${ext}.`
      : 'Поддерживаются только файлы CSV и PDF.'
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function readFileBase64(uri: string): Promise<string> {
  return arrayBufferToBase64(await new File(uri).arrayBuffer());
}

export async function readCsvTextFromUri(uri: string): Promise<string> {
  const bytes = new Uint8Array(await new File(uri).arrayBuffer());
  const body =
    bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  const utf8 = new TextDecoder('utf-8').decode(body);

  if (!utf8.includes('\uFFFD') && /дата|сумма|date|amount|операц/i.test(utf8.slice(0, 4000))) {
    return utf8;
  }

  try {
    const cp1251 = new TextDecoder('windows-1251').decode(body);
    if (/дата|сумма|date|amount|операц/i.test(cp1251.slice(0, 4000))) {
      return cp1251;
    }
  } catch {
    // windows-1251 may be unavailable on some runtimes
  }

  return utf8;
}

const PDF_EDGE_TIMEOUT_MS = 45_000;
const PDF_LOCAL_TIMEOUT_MS = Platform.OS === 'web' ? 30_000 : 12_000;

async function readPdfTextLocal(base64: string): Promise<string> {
  const { extractPdfTextFromBase64 } = await import('./pdfTextClient');
  const local = await withTimeout(
    extractPdfTextFromBase64(base64),
    PDF_LOCAL_TIMEOUT_MS,
    'Не удалось прочитать PDF на устройстве'
  );
  if (!local.text.trim()) {
    throw new Error('В PDF нет текстового слоя');
  }
  return local.text;
}

async function readPdfTextFromEdge(base64: string): Promise<string> {
  const pdfResult = await withTimeout(
    requestBankStatementPdfText(base64),
    PDF_EDGE_TIMEOUT_MS,
    'Сервер не ответил при чтении PDF'
  );
  if (!pdfResult.ok || !pdfResult.text) {
    throw new Error(
      pdfResult.message ??
        'Не удалось прочитать PDF на сервере. Скачайте выписку в CSV или задеплойте bank-statement-pdf-text.'
    );
  }
  return pdfResult.text;
}

async function readPdfText(base64: string): Promise<string> {
  const errors: string[] = [];

  if (Platform.OS !== 'web') {
    try {
      return await readPdfTextFromEdge(base64);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Ошибка сервера');
    }

    try {
      return await readPdfTextLocal(base64);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Ошибка на устройстве');
    }
  } else {
    try {
      return await readPdfTextLocal(base64);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Ошибка на устройстве');
    }

    try {
      return await readPdfTextFromEdge(base64);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Ошибка сервера');
    }
  }

  throw new Error(
    errors[0] ??
      'Не удалось прочитать PDF. Скачайте выписку в CSV или проверьте интернет.'
  );
}

export async function parseBankStatementFile(input: {
  uri: string;
  fileName: string;
  providerId: string;
  mimeType?: string | null;
}): Promise<StatementParseResult> {
  const kind = detectStatementFileKind(input.fileName, input.mimeType);

  if (kind === 'pdf') {
    const base64 = await readFileBase64(input.uri);
    const text = await readPdfText(base64);
    return parseBankStatementText(text, input.fileName, input.providerId);
  }

  const content = await readCsvTextFromUri(input.uri);
  return parseBankStatementText(content, input.fileName, input.providerId);
}

export function formatStatementReadError(error: unknown): string {
  if (!(error instanceof Error)) return 'Проверьте формат выписки (CSV или PDF).';
  const msg = error.message;
  if (
    msg.includes('text encoding') ||
    msg.includes("couldn't be opened") ||
    msg.includes('could not be opened')
  ) {
    return 'Не удалось открыть файл. Выберите CSV или PDF с текстовым слоем.';
  }
  return msg;
}
