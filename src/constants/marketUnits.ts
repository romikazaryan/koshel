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

/** Быстрый выбор в форме — остальное через поиск CoinGecko. */
export const CRYPTO_QUICK_PICKS = CRYPTO_UNITS.filter((item) =>
  ['btc', 'eth', 'usdt', 'sol', 'ton', 'bnb', 'doge', 'link'].includes(item.value)
);

export const FX_UNITS: { value: FxUnit; label: string; symbol: string }[] = [
  { value: 'usd', label: 'Доллар США', symbol: 'USD' },
  { value: 'eur', label: 'Евро', symbol: 'EUR' },
  { value: 'cny', label: 'Юань', symbol: 'CNY' },
];

/** Популярные тикеры MOEX — быстрый выбор; остальное через поиск. */
export const STOCK_QUICK_PICKS: { value: string; label: string; symbol: string }[] = [
  { value: 'sber', label: 'Сбербанк', symbol: 'SBER' },
  { value: 'gazp', label: 'Газпром', symbol: 'GAZP' },
  { value: 'lkoh', label: 'Лукойл', symbol: 'LKOH' },
  { value: 'yndx', label: 'Яндекс', symbol: 'YNDX' },
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

export function isCryptoUnit(unit: string): unit is CryptoUnit {
  return unit in CRYPTO_TO_COINGECKO;
}

export function parseCryptoUnit(unit: string): { coingeckoId: string; symbol: string } | null {
  if (isCryptoUnit(unit)) {
    const preset = CRYPTO_UNITS.find((item) => item.value === unit);
    return {
      coingeckoId: getCoingeckoId(unit),
      symbol: preset?.symbol ?? unit.toUpperCase(),
    };
  }

  if (!unit.startsWith('cg:')) return null;
  const body = unit.slice(3);
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

export function buildCryptoUnit(coingeckoId: string, symbol: string): string {
  const preset = CRYPTO_UNITS.find((item) => CRYPTO_TO_COINGECKO[item.value] === coingeckoId);
  if (preset) return preset.value;
  return `cg:${coingeckoId}:${symbol.toLowerCase()}`;
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

export function isValidStockTicker(value: string) {
  const ticker = normalizeStockTicker(value);
  return /^[a-z][a-z0-9.\-]{1,11}$/.test(ticker);
}

export function getUnitSymbol(unit: string) {
  const crypto = parseCryptoUnit(unit);
  if (crypto) return crypto.symbol;

  const fx = FX_UNITS.find((item) => item.value === unit);
  if (fx) return fx.symbol;

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
