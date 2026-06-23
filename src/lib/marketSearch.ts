import {
  buildCryptoUnit,
  CRYPTO_UNITS,
  getCoingeckoId,
  type CryptoUnit,
} from '../constants/marketUnits';

const SEARCH_TIMEOUT_MS = 12_000;
const MIN_QUERY_LENGTH = 1;

export type MarketSearchItem = {
  unit: string;
  symbol: string;
  name: string;
  subtitle?: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

type MoexSecuritiesResponse = {
  securities?: {
    columns: string[];
    data: (string | number | null)[][];
  };
};

const MOEX_SHARE_GROUPS = new Set(['stock_shares', 'stock_shares_rub']);

function parseMoexRow(columns: string[], row: (string | number | null)[]) {
  const read = (key: string) => {
    const idx = columns.indexOf(key);
    return idx >= 0 ? String(row[idx] ?? '').trim() : '';
  };
  return {
    secid: read('secid'),
    shortname: read('shortname'),
    name: read('name'),
    isin: read('isin'),
    type: read('type'),
    group: read('group'),
    isTraded: read('is_traded') === '1',
  };
}

function isMoexShare(row: ReturnType<typeof parseMoexRow>) {
  if (!row.secid) return false;
  if (!/^[A-Za-z][A-Za-z0-9.\-]{1,11}$/.test(row.secid)) return false;
  if (MOEX_SHARE_GROUPS.has(row.group)) return true;
  if (row.type.includes('share')) return true;
  return false;
}

function moexRank(query: string, row: ReturnType<typeof parseMoexRow>) {
  const q = query.toLowerCase();
  const secid = row.secid.toLowerCase();
  const shortname = row.shortname.toLowerCase();
  const name = row.name.toLowerCase();
  if (secid === q) return 0;
  if (secid.startsWith(q)) return 1;
  if (shortname.startsWith(q)) return 2;
  if (name.includes(q)) return 3;
  return 4;
}

export async function searchMoexStocks(query: string): Promise<MarketSearchItem[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];

  const url = `https://iss.moex.com/iss/securities.json?q=${encodeURIComponent(q)}&iss.meta=off&securities.columns=secid,shortname,name,isin,is_traded,type,group&limit=40`;
  const data = await fetchJson<MoexSecuritiesResponse>(url);
  const columns = data.securities?.columns ?? [];
  const rows = data.securities?.data ?? [];

  const seen = new Set<string>();
  const items: { rank: number; item: MarketSearchItem }[] = [];

  for (const row of rows) {
    const parsed = parseMoexRow(columns, row);
    if (!isMoexShare(parsed)) continue;
    const ticker = parsed.secid.toLowerCase();
    if (seen.has(ticker)) continue;
    seen.add(ticker);

    items.push({
      rank: moexRank(q, parsed),
      item: {
        unit: ticker,
        symbol: parsed.secid.toUpperCase(),
        name: parsed.name || parsed.shortname || parsed.secid,
        subtitle: parsed.shortname && parsed.shortname !== parsed.name ? parsed.shortname : parsed.isin || undefined,
      },
    });
  }

  return items
    .sort((a, b) => a.rank - b.rank || a.item.symbol.localeCompare(b.item.symbol))
    .slice(0, 10)
    .map((entry) => entry.item);
}

type CoingeckoSearch = {
  coins?: {
    id: string;
    name: string;
    symbol: string;
    market_cap_rank?: number | null;
  }[];
};

const PRESET_COINGECKO_IDS = new Set(
  CRYPTO_UNITS.map((item) => getCoingeckoId(item.value as CryptoUnit))
);

function coingeckoSearchRank(
  query: string,
  coin: { id: string; symbol: string; market_cap_rank?: number | null }
) {
  const q = query.toLowerCase().trim();
  const symbol = coin.symbol.toLowerCase();
  const id = coin.id.toLowerCase();
  const capRank = coin.market_cap_rank ?? 9999;

  if (PRESET_COINGECKO_IDS.has(coin.id)) return -10_000 + capRank;
  if (symbol === q) return capRank;
  if (id === q) return 100 + capRank;
  if (symbol.startsWith(q)) return 200 + capRank;
  return 1000 + capRank;
}

export async function searchCoingeckoCoins(query: string): Promise<MarketSearchItem[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY_LENGTH) return [];

  const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`;
  const data = await fetchJson<CoingeckoSearch>(url);
  const coins = data.coins ?? [];
  const qLower = q.toLowerCase();

  const hasPresetSymbolMatch = coins.some(
    (coin) => PRESET_COINGECKO_IDS.has(coin.id) && coin.symbol.toLowerCase() === qLower
  );

  const filtered = hasPresetSymbolMatch
    ? coins.filter((coin) => {
        if (PRESET_COINGECKO_IDS.has(coin.id)) return true;
        if (coin.symbol.toLowerCase() === qLower) return false;
        return true;
      })
    : coins;

  return filtered
    .map((coin) => ({ coin, rank: coingeckoSearchRank(q, coin) }))
    .sort((a, b) => a.rank - b.rank || a.coin.symbol.localeCompare(b.coin.symbol))
    .slice(0, 10)
    .map(({ coin }) => ({
      unit: buildCryptoUnit(coin.id, coin.symbol),
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      subtitle: coin.market_cap_rank ? `Топ-${coin.market_cap_rank}` : undefined,
    }));
}
