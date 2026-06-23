export type CryptoUnit =
  | 'btc'
  | 'eth'
  | 'usdt'
  | 'ton'
  | 'sol'
  | 'bnb'
  | 'xrp'
  | 'ada'
  | 'doge'
  | 'avax'
  | 'link'
  | 'render'
  | 'ltc'
  | 'trx'
  | 'uni'
  | 'shib'
  | 'dot'
  | 'near';

export type FxUnit = 'usd' | 'eur' | 'cny';
export type MarketUnit = CryptoUnit | FxUnit;

export const CRYPTO_UNITS: { value: CryptoUnit; label: string; symbol: string }[] = [
  { value: 'btc', label: 'Bitcoin', symbol: 'BTC' },
  { value: 'eth', label: 'Ethereum', symbol: 'ETH' },
  { value: 'usdt', label: 'Tether', symbol: 'USDT' },
  { value: 'sol', label: 'Solana', symbol: 'SOL' },
  { value: 'ton', label: 'Toncoin', symbol: 'TON' },
  { value: 'bnb', label: 'BNB', symbol: 'BNB' },
  { value: 'xrp', label: 'Ripple', symbol: 'XRP' },
  { value: 'ada', label: 'Cardano', symbol: 'ADA' },
  { value: 'doge', label: 'Dogecoin', symbol: 'DOGE' },
  { value: 'avax', label: 'Avalanche', symbol: 'AVAX' },
  { value: 'link', label: 'Chainlink', symbol: 'LINK' },
  { value: 'render', label: 'Render', symbol: 'RENDER' },
  { value: 'ltc', label: 'Litecoin', symbol: 'LTC' },
  { value: 'trx', label: 'Tron', symbol: 'TRX' },
  { value: 'uni', label: 'Uniswap', symbol: 'UNI' },
  { value: 'shib', label: 'Shiba Inu', symbol: 'SHIB' },
  { value: 'dot', label: 'Polkadot', symbol: 'DOT' },
  { value: 'near', label: 'NEAR', symbol: 'NEAR' },
];

/** Быстрый выбор в форме — все предустановленные монеты. */
export const CRYPTO_QUICK_PICKS = CRYPTO_UNITS;

export const FX_UNITS: { value: FxUnit; label: string; symbol: string }[] = [
  { value: 'usd', label: 'Доллар США', symbol: 'USD' },
  { value: 'eur', label: 'Евро', symbol: 'EUR' },
  { value: 'cny', label: 'Юань', symbol: 'CNY' },
];

const TINVEST_CURRENCY_TICKERS: Record<string, FxUnit | 'rub' | 'gbp' | 'chf' | 'hkd' | 'jpy'> = {
  rub: 'rub',
  usd000utstom: 'usd',
  usd000utstm: 'usd',
  eur000utstom: 'eur',
  eur000utstm: 'eur',
  cny000000rub: 'cny',
  cnyrub_tom: 'cny',
};

/** T-Invest валютные тикеры → короткий код (usd, eur…). */
export function resolveTinvestCurrencyUnit(ticker: string, moneyCurrency?: string): string {
  const lower = ticker.trim().toLowerCase();
  if (lower in TINVEST_CURRENCY_TICKERS) {
    const mapped = TINVEST_CURRENCY_TICKERS[lower];
    return mapped === 'rub' ? 'rub' : mapped;
  }

  const fromMoney = moneyCurrency?.trim().toLowerCase();
  if (fromMoney && (fromMoney in FX_TO_CBR || fromMoney === 'rub')) {
    return fromMoney;
  }

  const prefix = lower.match(/^(usd|eur|cny|gbp|chf|hkd|jpy|rub)/)?.[1];
  if (prefix) return prefix;

  return lower;
}

export function getFxUnitLabel(unit: string): string | undefined {
  const fx = FX_UNITS.find((item) => item.value === unit);
  if (fx) return fx.label;
  if (unit === 'rub') return 'Рубли';
  return undefined;
}

/** Популярные тикеры MOEX — быстрый выбор; остальное через поиск. */
export const STOCK_QUICK_PICKS: { value: string; label: string; symbol: string }[] = [
  { value: 'sber', label: 'Сбербанк', symbol: 'SBER' },
  { value: 'gazp', label: 'Газпром', symbol: 'GAZP' },
  { value: 'lkoh', label: 'Лукойл', symbol: 'LKOH' },
  { value: 'yndx', label: 'Яндекс', symbol: 'YNDX' },
  { value: 'ydex', label: 'Яндекс', symbol: 'YDEX' },
  { value: 'vkco', label: 'ВК', symbol: 'VKCO' },
  { value: 'vtbr', label: 'ВТБ', symbol: 'VTBR' },
];

/** @deprecated Используйте STOCK_QUICK_PICKS */
export const STOCK_TICKERS = STOCK_QUICK_PICKS;

const CRYPTO_TO_COINGECKO: Record<CryptoUnit, string> = {
  btc: 'bitcoin',
  eth: 'ethereum',
  usdt: 'tether',
  ton: 'the-open-network',
  sol: 'solana',
  bnb: 'binancecoin',
  xrp: 'ripple',
  ada: 'cardano',
  doge: 'dogecoin',
  avax: 'avalanche-2',
  link: 'chainlink',
  render: 'render-token',
  ltc: 'litecoin',
  trx: 'tron',
  uni: 'uniswap',
  shib: 'shiba-inu',
  dot: 'polkadot',
  near: 'near',
};

const FX_TO_CBR: Record<FxUnit, string> = {
  usd: 'USD',
  eur: 'EUR',
  cny: 'CNY',
};

const COINGECKO_ID_TO_CRYPTO = Object.fromEntries(
  Object.entries(CRYPTO_TO_COINGECKO).map(([unit, id]) => [id, unit])
) as Record<string, CryptoUnit>;

export function normalizeCryptoUnit(unit: string): string {
  const trimmed = unit.trim().toLowerCase();
  if (trimmed in CRYPTO_TO_COINGECKO) return trimmed;
  if (trimmed.startsWith('cg:')) return trimmed;
  if (trimmed in COINGECKO_ID_TO_CRYPTO) return COINGECKO_ID_TO_CRYPTO[trimmed];
  return trimmed;
}

export function isCryptoUnit(unit: string): unit is CryptoUnit {
  const normalized = normalizeCryptoUnit(unit);
  return normalized in CRYPTO_TO_COINGECKO;
}

export function parseCryptoUnit(unit: string): { coingeckoId: string; symbol: string } | null {
  const normalized = normalizeCryptoUnit(unit);

  if (isCryptoUnit(normalized)) {
    const preset = CRYPTO_UNITS.find((item) => item.value === normalized);
    return {
      coingeckoId: getCoingeckoId(normalized),
      symbol: preset?.symbol ?? normalized.toUpperCase(),
    };
  }

  if (!normalized.startsWith('cg:')) return null;
  const body = normalized.slice(3);
  const [coingeckoId, symbolPart] = body.split(':');
  if (!coingeckoId) return null;
  return {
    coingeckoId,
    symbol: (symbolPart ?? coingeckoId).toUpperCase(),
  };
}

export function isCryptoMarketUnit(unit: string): boolean {
  return parseCryptoUnit(unit) != null;
}

export function canonicalizeCryptoUnit(unit: string): string {
  const normalized = normalizeCryptoUnit(unit);
  if (normalized in CRYPTO_TO_COINGECKO) return normalized;

  const id = resolveCoingeckoId(normalized);
  if (id && id in COINGECKO_ID_TO_CRYPTO) {
    return COINGECKO_ID_TO_CRYPTO[id];
  }

  return normalized;
}

export function buildCryptoUnit(coingeckoId: string, symbol: string): string {
  const id = coingeckoId.trim().toLowerCase();
  if (id in COINGECKO_ID_TO_CRYPTO) return COINGECKO_ID_TO_CRYPTO[id];
  const preset = CRYPTO_UNITS.find((item) => CRYPTO_TO_COINGECKO[item.value] === id);
  if (preset) return preset.value;
  return `cg:${id}:${symbol.toLowerCase()}`;
}

export function resolveCoingeckoId(unit: string): string | null {
  return parseCryptoUnit(unit)?.coingeckoId ?? null;
}

export function isFxUnit(unit: string): unit is FxUnit {
  return unit in FX_TO_CBR;
}

export function isMarketUnit(unit: string): unit is MarketUnit {
  return isCryptoUnit(unit) || isFxUnit(unit);
}

export function getCoingeckoId(unit: CryptoUnit) {
  return CRYPTO_TO_COINGECKO[unit];
}

export function getCbrCode(unit: FxUnit) {
  return FX_TO_CBR[unit];
}

export function normalizeStockTicker(value: string) {
  return value.trim().toLowerCase().replace(/\.me$/i, '');
}

/** Старые/альтернативные коды → актуальный тикер MOEX. */
const MOEX_TICKER_ALIASES: Record<string, string> = {
  yndx: 'ydex',
  vk: 'vkco',
};

export function resolveMoexTicker(unit: string): string {
  const normalized = normalizeStockTicker(unit);
  return MOEX_TICKER_ALIASES[normalized] ?? normalized;
}

export function isValidStockTicker(value: string) {
  const ticker = normalizeStockTicker(value);
  return /^[a-z][a-z0-9.\-]{1,11}$/.test(ticker);
}

export function getUnitSymbol(unit: string) {
  const crypto = parseCryptoUnit(unit);
  if (crypto) return crypto.symbol;

  const normalizedFx = resolveTinvestCurrencyUnit(unit);
  const fx = FX_UNITS.find((item) => item.value === unit || item.value === normalizedFx);
  if (fx) return fx.symbol;

  if (normalizedFx === 'rub') return 'RUB';

  const stock =
    STOCK_QUICK_PICKS.find((item) => item.value === normalizeStockTicker(unit)) ??
    STOCK_TICKERS.find((item) => item.value === normalizeStockTicker(unit));
  if (stock) return stock.symbol;

  return normalizeStockTicker(unit).toUpperCase();
}

export function getRateSourceLabel(unit: string, assetType?: string) {
  if (isCryptoMarketUnit(unit)) return 'CoinGecko';
  if (isFxUnit(unit)) return 'ЦБ РФ';
  if (assetType === 'stocks') return 'MOEX';
  return '';
}
