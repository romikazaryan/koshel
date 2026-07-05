import type { Category } from '../types';
import { inferCategoryFromText } from './transactionCategory';

const HUNDRED_WORDS: Record<string, number> = {
  сто: 100,
  двести: 200,
  триста: 300,
  четыреста: 400,
  пятьсот: 500,
  шестьсот: 600,
  семьсот: 700,
  восемьсот: 800,
  девятьсот: 900,
};

/** Простой разбор суммы из русской речи (запасной вариант без GPT). */
export function extractAmountFromSpeech(text: string): number | null {
  const normalized = text.toLowerCase().replace(/,/g, '.');

  const thousandMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:тыс|тысяч)/);
  if (thousandMatch) {
    const value = Number(thousandMatch[1]) * 1000;
    if (Number.isFinite(value) && value > 0) return Math.round(value);
  }

  if (/\bполтор[аы]\s*тыс/.test(normalized)) return 1500;
  if (/\bполтора\s*тыс/.test(normalized)) return 1500;

  for (const [word, amount] of Object.entries(HUNDRED_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(normalized)) return amount;
  }

  const rubleMatches = [...normalized.matchAll(/(\d[\d\s]*(?:\.\d+)?)\s*(?:₽|руб|р\b)/g)];
  if (rubleMatches.length > 0) {
    const raw = rubleMatches[rubleMatches.length - 1][1].replace(/\s/g, '');
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) return value;
  }

  const plainNumbers = [...normalized.matchAll(/\b(\d[\d\s]{0,8}(?:\.\d+)?)\b/g)]
    .map((m) => Number(m[1].replace(/\s/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 10_000_000);

  if (plainNumbers.length > 0) {
    return plainNumbers[plainNumbers.length - 1];
  }

  return null;
}

export function inferCategoryFromSpeech(text: string): Category | null {
  const category = inferCategoryFromText(text, 'expense');
  return category === 'Другое' ? null : (category as Category);
}

export function parseVoiceLocally(text: string): { sum: number; category: Category; note: string } | null {
  const sum = extractAmountFromSpeech(text);
  if (!sum) return null;
  const category = inferCategoryFromSpeech(text) ?? 'Другое';
  return { sum, category, note: text.trim() };
}
