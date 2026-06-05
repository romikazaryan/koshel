import type { Category } from '../types';

const CATEGORY_KEYWORDS: Array<{ pattern: RegExp; category: Category }> = [
  { pattern: /продукт|пятёроч|пятероч|магнит|перекрёст|ашан|лента|супермаркет/i, category: 'Продукты' },
  { pattern: /метро|такси|яндекс\s*го|бензин|азс|транспорт|автобус/i, category: 'Транспорт' },
  { pattern: /кофе|кафе|ресторан|обед|ужин|завтрак|бургер|пицц|starbucks|старбакс/i, category: 'Кафе' },
  { pattern: /кино|театр|игр|подписк|netflix|нетфликс|развлеч/i, category: 'Развлечения' },
  { pattern: /жкх|квартплат|электри|интернет|связь|мтс|билайн|теле2|коммунал/i, category: 'ЖКХ' },
  { pattern: /одежд|обув|zara|hm|лэтуаль|рив гош/i, category: 'Одежда' },
  { pattern: /аптек|лекарств|клиник|врач|здоров/i, category: 'Здоровье' },
];

/** Простой разбор суммы из русской речи (запасной вариант без GPT). */
export function extractAmountFromSpeech(text: string): number | null {
  const normalized = text.toLowerCase().replace(/,/g, '.');

  const thousandMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:тыс|тысяч)/);
  if (thousandMatch) {
    const value = Number(thousandMatch[1]) * 1000;
    if (Number.isFinite(value) && value > 0) return Math.round(value);
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
  for (const { pattern, category } of CATEGORY_KEYWORDS) {
    if (pattern.test(text)) return category;
  }
  return null;
}

export function parseVoiceLocally(text: string): { sum: number; category: Category; note: string } | null {
  const sum = extractAmountFromSpeech(text);
  if (!sum) return null;
  const category = inferCategoryFromSpeech(text) ?? 'Другое';
  return { sum, category, note: text.trim() };
}
