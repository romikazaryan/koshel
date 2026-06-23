import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchFxRatesRub } from '../lib/marketRates';

export type DisplayCurrency = 'RUB' | 'USD' | 'EUR';

const ORDER: DisplayCurrency[] = ['RUB', 'USD', 'EUR'];
const SYMBOL: Record<DisplayCurrency, string> = { RUB: '₽', USD: '$', EUR: '€' };

type CapitalCurrencyValue = {
  currency: DisplayCurrency;
  symbol: string;
  cycle: () => void;
  /** Конвертирует рубли в выбранную валюту (null — курс ещё не получен). */
  convert: (valueRub: number) => number | null;
  /** Сумма с символом валюты, адаптивные дробные. */
  format: (valueRub: number) => string;
  /** Сумма со знаком +/− (для динамики). */
  formatSigned: (valueRub: number) => string;
};

const CapitalCurrencyContext = createContext<CapitalCurrencyValue | null>(null);

function formatAmount(value: number, symbol: string, signed: boolean) {
  const abs = Math.abs(value);
  const decimals = abs >= 1000 ? 0 : 2;
  const sign = signed ? (value > 0 ? '+' : value < 0 ? '−' : '') : '';
  const num = abs.toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  return `${sign}${symbol}${num}`;
}

export function CapitalCurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<DisplayCurrency>('RUB');
  const [rubPerUsd, setRubPerUsd] = useState<number | null>(null);
  const [rubPerEur, setRubPerEur] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void fetchFxRatesRub(['usd', 'eur'])
      .then((rates) => {
        if (!active) return;
        if (rates.usd) setRubPerUsd(rates.usd);
        if (rates.eur) setRubPerEur(rates.eur);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const rate = currency === 'USD' ? rubPerUsd : currency === 'EUR' ? rubPerEur : 1;

  const cycle = useCallback(() => {
    setCurrency((prev) => {
      const idx = ORDER.indexOf(prev);
      const next = ORDER[(idx + 1) % ORDER.length];
      // Если курс для следующей валюты ещё не загружен — пропускаем к рублям.
      if (next === 'USD' && rubPerUsd == null) return ORDER[(idx + 2) % ORDER.length];
      if (next === 'EUR' && rubPerEur == null) return 'RUB';
      return next;
    });
  }, [rubPerUsd, rubPerEur]);

  const convert = useCallback(
    (valueRub: number): number | null => {
      if (currency === 'RUB') return valueRub;
      if (!rate || rate <= 0) return null;
      return valueRub / rate;
    },
    [currency, rate]
  );

  const format = useCallback(
    (valueRub: number) => {
      const converted = convert(valueRub);
      if (converted == null) return formatAmount(valueRub, SYMBOL.RUB, false);
      return formatAmount(converted, SYMBOL[currency], false);
    },
    [convert, currency]
  );

  const formatSigned = useCallback(
    (valueRub: number) => {
      const converted = convert(valueRub);
      if (converted == null) return formatAmount(valueRub, SYMBOL.RUB, true);
      return formatAmount(converted, SYMBOL[currency], true);
    },
    [convert, currency]
  );

  const value = useMemo<CapitalCurrencyValue>(
    () => ({ currency, symbol: SYMBOL[currency], cycle, convert, format, formatSigned }),
    [currency, cycle, convert, format, formatSigned]
  );

  return (
    <CapitalCurrencyContext.Provider value={value}>{children}</CapitalCurrencyContext.Provider>
  );
}

export function useCapitalCurrency(): CapitalCurrencyValue {
  const ctx = useContext(CapitalCurrencyContext);
  if (!ctx) {
    throw new Error('useCapitalCurrency must be used within CapitalCurrencyProvider');
  }
  return ctx;
}
