const RUBLE = '₽';

export type FormatMoneyOptions = {
  /** Кол-во знаков после запятой (по умолчанию 0). */
  decimals?: number;
  /** Показывать «+» для положительных значений (для дельт/динамики). */
  signed?: boolean;
  /** Символ валюты (по умолчанию ₽). */
  symbol?: string;
};

/**
 * Единый формат денежных сумм по всему приложению.
 * Группировка по-русски (1 234), символ ₽ перед числом, аккуратный минус.
 * Для моноширинных цифр используйте стиль moneyText (fontVariant tabular-nums).
 */
export function formatMoney(amount: number, options: FormatMoneyOptions = {}): string {
  const { decimals = 0, signed = false, symbol = RUBLE } = options;
  const safe = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safe);
  const body = abs.toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const sign = safe < 0 ? '−' : signed ? '+' : '';
  return `${sign}${symbol}${body}`;
}
