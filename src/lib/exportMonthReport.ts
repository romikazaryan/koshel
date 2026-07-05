import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { formatMoney } from './formatMoney';
import type { Transaction } from '../types';

export type MonthReportSummary = {
  monthLabel: string;
  income: number;
  expenses: number;
  balance: number;
  monthlyBudget: number | null;
  transactions: Transaction[];
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function topCategories(transactions: Transaction[], kind: 'income' | 'expense', limit = 5) {
  const map = new Map<string, number>();
  for (const row of transactions) {
    if (row.kind !== kind) continue;
    map.set(row.category, (map.get(row.category) ?? 0) + row.amount);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export function buildMonthReportHtml(summary: MonthReportSummary): string {
  const { monthLabel, income, expenses, balance, monthlyBudget, transactions } = summary;
  const expenseRows = transactions
    .filter((t) => t.kind === 'expense')
    .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)
    .slice(0, 40);
  const topExpenseCats = topCategories(transactions, 'expense');
  const budgetLine =
    monthlyBudget != null
      ? `<p class="meta">Лимит: ${escapeHtml(formatMoney(monthlyBudget))} · использовано ${Math.round(
          monthlyBudget > 0 ? (expenses / monthlyBudget) * 100 : 0
        )}%</p>`
      : '';

  const categoryRows = topExpenseCats
    .map(
      ([cat, amount]) =>
        `<tr><td>${escapeHtml(cat)}</td><td class="num">${escapeHtml(formatMoney(amount))}</td></tr>`
    )
    .join('');

  const txRows = expenseRows
    .map(
      (t) =>
        `<tr><td>${escapeHtml(t.date)}</td><td>${escapeHtml(t.title)}</td><td>${escapeHtml(
          t.category
        )}</td><td class="num">${escapeHtml(formatMoney(t.amount))}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1E1840; margin: 32px; }
    h1 { font-size: 24px; margin: 0 0 4px; letter-spacing: -0.5px; }
    .brand { color: #857F9E; font-size: 12px; letter-spacing: 2px; text-transform: lowercase; margin-bottom: 18px; }
    .hero {
      background: linear-gradient(135deg, #241A9E 0%, #120A8F 100%);
      color: #FFE9D6;
      border-radius: 16px;
      padding: 20px 22px;
      margin-bottom: 22px;
    }
    .hero h2 { margin: 0 0 12px; font-size: 13px; opacity: 0.8; text-transform: uppercase; letter-spacing: 0.6px; }
    .metrics { display: flex; gap: 16px; flex-wrap: wrap; }
    .metric { min-width: 120px; }
    .metric .label { font-size: 11px; opacity: 0.75; text-transform: uppercase; }
    .metric .value { font-size: 22px; font-weight: 800; margin-top: 4px; }
    h3 { font-size: 15px; margin: 24px 0 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { padding: 8px 6px; border-bottom: 1px solid #F0C6A4; text-align: left; vertical-align: top; }
    th { color: #857F9E; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
    .num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .meta { color: #857F9E; font-size: 12px; margin-top: 8px; }
    .footer { margin-top: 28px; color: #857F9E; font-size: 11px; }
  </style>
</head>
<body>
  <div class="brand">koshel</div>
  <h1>Сводка за ${escapeHtml(monthLabel)}</h1>
  ${budgetLine}
  <div class="hero">
    <h2>Итоги месяца</h2>
    <div class="metrics">
      <div class="metric"><div class="label">Баланс</div><div class="value">${escapeHtml(formatMoney(balance))}</div></div>
      <div class="metric"><div class="label">Доход</div><div class="value">${escapeHtml(formatMoney(income))}</div></div>
      <div class="metric"><div class="label">Расход</div><div class="value">${escapeHtml(formatMoney(expenses))}</div></div>
    </div>
  </div>
  <h3>Топ категорий расходов</h3>
  <table>
    <thead><tr><th>Категория</th><th class="num">Сумма</th></tr></thead>
    <tbody>${categoryRows || '<tr><td colspan="2">Нет расходов</td></tr>'}</tbody>
  </table>
  <h3>Последние расходы</h3>
  <table>
    <thead><tr><th>Дата</th><th>Название</th><th>Категория</th><th class="num">Сумма</th></tr></thead>
    <tbody>${txRows || '<tr><td colspan="4">Нет операций</td></tr>'}</tbody>
  </table>
  <p class="footer">Сформировано в koshel · ${escapeHtml(new Date().toLocaleString('ru-RU'))}</p>
</body>
</html>`;
}

export type ExportPdfResult = 'shared' | 'unavailable';

export async function exportMonthReportPdf(summary: MonthReportSummary): Promise<ExportPdfResult> {
  const html = buildMonthReportHtml(summary);
  const { uri } = await Print.printToFileAsync({ html });

  if (!(await Sharing.isAvailableAsync())) {
    return 'unavailable';
  }

  const safeName = `koshel-${summary.monthLabel.replace(/\s+/g, '-').toLowerCase()}.pdf`;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'PDF-сводка месяца',
    UTI: 'com.adobe.pdf',
  });
  return 'shared';
}
