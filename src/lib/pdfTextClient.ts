import { getDocument } from 'pdfjs-serverless';

type PdfTextItem = {
  str: string;
  transform: number[];
  width?: number;
};

function joinLineParts(parts: Array<{ x: number; str: string; width: number }>): string {
  if (parts.length === 0) return '';

  let result = parts[0].str;
  for (let i = 1; i < parts.length; i += 1) {
    const prev = parts[i - 1];
    const curr = parts[i];
    const prevEnd = prev.x + Math.max(prev.width, prev.str.length * 4);
    const gap = curr.x - prevEnd;

    if (gap > 18) {
      result += `  ${curr.str}`;
    } else if (gap > 6 || !result.endsWith(' ')) {
      result += ` ${curr.str}`;
    } else {
      result += curr.str;
    }
  }

  return result.replace(/[ \t]{3,}/g, '  ').trim();
}

function extractPageLines(items: PdfTextItem[]): string[] {
  const lineMap = new Map<number, Array<{ x: number; str: string; width: number }>>();

  for (const item of items) {
    const str = item.str?.replace(/\u00a0/g, ' ');
    if (!str?.trim()) continue;

    const y = Math.round(item.transform[5] ?? 0);
    const x = item.transform[4] ?? 0;
    const width = item.width ?? str.length * 5;
    const bucket = lineMap.get(y) ?? [];
    bucket.push({ x, str, width });
    lineMap.set(y, bucket);
  }

  const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
  const lines: string[] = [];

  for (const y of sortedYs) {
    const parts = (lineMap.get(y) ?? []).sort((a, b) => a.x - b.x);
    const line = joinLineParts(parts);
    if (line) lines.push(line);
  }

  return lines;
}

function normalizeBase64(input: string): string {
  const commaIdx = input.indexOf(',');
  return commaIdx >= 0 ? input.slice(commaIdx + 1) : input;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(normalizeBase64(base64));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Извлечение текста из PDF на устройстве — fallback, если Edge Function недоступна. */
export async function extractPdfTextFromBase64(
  fileBase64: string
): Promise<{ text: string; pages: number }> {
  const pdfBytes = base64ToBytes(fileBase64);
  const document = await getDocument({
    data: pdfBytes,
    useSystemFonts: true,
  }).promise;

  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= document.numPages; pageNum += 1) {
    const page = await document.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items.filter(
      (item) =>
        typeof item === 'object' &&
        item != null &&
        'str' in item &&
        Array.isArray((item as PdfTextItem).transform)
    ) as unknown as PdfTextItem[];
    parts.push(...extractPageLines(items));
  }

  const pages = document.numPages;
  await document.destroy();

  return {
    text: parts.join('\n'),
    pages,
  };
}
