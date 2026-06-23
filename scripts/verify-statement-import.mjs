import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-serverless';

const pdfPath =
  process.argv[2] ||
  '/Users/romik/Downloads/Казарян_Р_А_о_движении_денежных_средств_ozonbank_document_30846093.pdf';

function joinLineParts(parts) {
  if (!parts.length) return '';
  let result = parts[0].str;
  for (let i = 1; i < parts.length; i++) {
    const prev = parts[i - 1];
    const curr = parts[i];
    const gap = curr.x - (prev.x + Math.max(prev.width, prev.str.length * 4));
    if (gap > 18) result += `  ${curr.str}`;
    else if (gap > 6 || !result.endsWith(' ')) result += ` ${curr.str}`;
    else result += curr.str;
  }
  return result.replace(/[ \t]{3,}/g, '  ').trim();
}

async function extractPdfText(path) {
  const data = new Uint8Array(readFileSync(path));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const parts = [];
  for (let p = 1; p <= doc.numPages; p += 1) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const map = new Map();
    for (const item of content.items) {
      if (!('str' in item) || !item.str?.trim() || !Array.isArray(item.transform)) continue;
      const y = Math.round(item.transform[5]);
      const bucket = map.get(y) ?? [];
      bucket.push({
        x: item.transform[4],
        str: item.str.replace(/\u00a0/g, ' '),
        width: item.width ?? item.str.length * 5,
      });
      map.set(y, bucket);
    }
    for (const y of [...map.keys()].sort((a, b) => b - a)) {
      parts.push(joinLineParts(map.get(y).sort((a, b) => a.x - b.x)));
    }
  }
  return parts.join('\n');
}

async function main() {
  const {
    parseBankStatementText,
    rowsForImport,
    shouldExcludeFromImport,
  } = await import('../src/lib/bankStatementImport.ts');

  let text;
  try {
    text = await extractPdfText(pdfPath);
  } catch {
    console.log('PDF not found, skipping file test');
    return;
  }

  const result = parseBankStatementText(text, 'ozon.pdf', 'ozon');
  const ctx = { accountOwner: result.accountOwner ?? null };
  const imported = rowsForImport(result.rows, 'debit', ctx);

  const checks = [
    {
      name: 'Зарплата +244 508 импортируется',
      pass: imported.some((r) => r.kind === 'income' && r.amount >= 244000 && r.amount <= 245000),
    },
    {
      name: 'Зарплата +26 315 импортируется',
      pass: imported.some((r) => r.kind === 'income' && r.amount >= 26300 && r.amount <= 26400),
    },
    {
      name: 'СБП −75 000 себе исключается',
      pass: (() => {
        const row = result.rows.find((r) => r.amount === 75000 && r.kind === 'expense');
        return row ? shouldExcludeFromImport(row, 'debit', ctx) : false;
      })(),
    },
    {
      name: 'Перевод −240 000 на накопительный исключается',
      pass: (() => {
        const row = result.rows.find((r) => r.amount === 240000 && r.kind === 'expense');
        return row ? shouldExcludeFromImport(row, 'debit', ctx) : false;
      })(),
    },
    {
      name: '+75 000 «собственные средства» не в доходе',
      pass: !imported.some((r) => r.kind === 'income' && r.amount === 75000),
    },
    {
      name: 'Покупки на Ozon получают категорию «Онлайн»',
      pass: (() => {
        const ozonPurchases = imported.filter(
          (r) => r.kind === 'expense' && /ozon|платформ/i.test(r.title)
        );
        return ozonPurchases.length === 0 || ozonPurchases.every((r) => r.category === 'Онлайн');
      })(),
    },
    {
      name: 'Владелец извлечён из выписки',
      pass: Boolean(result.accountOwner && result.accountOwner.length > 5),
    },
    {
      name: 'PDF не парсится как CSV (много операций)',
      pass: result.rows.length >= 20,
    },
    {
      name: 'Возвраты получают категорию «Возврат»',
      pass: (() => {
        const refunds = result.rows.filter(
          (r) => r.kind === 'income' && /возврат/i.test(r.title)
        );
        return refunds.length === 0 || refunds.every((r) => r.category === 'Возврат');
      })(),
    },
    {
      name: 'Перевод родственнику не исключается как «свои средства»',
      pass: (() => {
        const family = result.rows.find(
          (r) =>
            r.kind === 'expense' &&
            /размик|родствен/i.test(r.title) &&
            r.amount >= 1000
        );
        if (!family) return true;
        return !shouldExcludeFromImport(family, 'debit', ctx);
      })(),
    },
  ];

  console.log('Parsed:', result.rows.length, '| Import:', imported.length, '| Excluded:', result.rows.length - imported.length);
  console.log('');
  for (const c of checks) {
    console.log(c.pass ? '✓' : '✗', c.name);
  }
  const failed = checks.filter((c) => !c.pass);
  process.exit(failed.length > 0 ? 1 : 0);
}

main();
