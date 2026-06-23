import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  CapitalAssetsPager,
  type CapitalAssetsPagerHandle,
} from '../components/capital/CapitalAssetsPager';
import { CapitalCategoryCarousel } from '../components/capital/CapitalCategoryCarousel';
import { CapitalHistoryPeriodToggle } from '../components/capital/CapitalHistoryPeriodToggle';
import { CapitalMarketAssetRow } from '../components/capital/CapitalMarketAssetRow';
import { CapitalSectionSummary } from '../components/capital/CapitalSectionSummary';
import { CapitalHeroCard } from '../components/capital/CapitalHeroCard';
import { CapitalManualAssetRow } from '../components/capital/CapitalManualAssetRow';
import {
  AddCapitalAssetSheet,
  type AddCapitalAssetPayload,
} from '../components/capital/AddCapitalAssetSheet';
import {
  buildAssetFilterOptions,
  getHistoryPeriodDays,
  type CapitalAssetFilter,
  type CapitalHistoryPeriod,
} from '../constants/capitalFilters';
import {
  canonicalizeCryptoUnit,
  getUnitSymbol,
  isCryptoMarketUnit,
  isFxUnit,
  resolveCoingeckoId,
  resolveMoexTicker,
} from '../constants/marketUnits';
import {
  deleteCapitalAsset,
  fetchCapitalAssets,
  getBrokerConnectionIds,
  getCapitalTotal,
  insertCapitalAsset,
  insertOrMergeCapitalAsset,
  isBrokerSyncedAsset,
  persistCapitalMarketSnapshots,
  setCapitalAssetActive,
  updateCapitalAssetAmount,
  updateCapitalAssetQuantity,
} from '../lib/capital';
import { requestTInvestSync } from '../lib/financialConnections';
import {
  buildCachedValuations,
  buildCapitalValuations,
  collectMarketSnapshots,
  formatQuantityLabel,
  latestStoredFetchedAt,
  mergeFreshMoexValuations,
  type AssetValuation,
} from '../lib/capitalValuation';
import { ensureHistoricalCacheHydrated } from '../lib/marketHistoricalCache';
import {
  rebuildRateHistoryInsightsFromCache,
  recordValuationSnapshotsIfDue,
  type RateHistoryInsight,
} from '../lib/capitalHistory';
import {
  buildHistoryInsightsFromCache,
  collectMarketAssetsForHistory,
  loadCapitalHistoryInsights,
  mergeHistoryInsights,
  mergePeriodMetricsWithValuations,
  prefetchIntradayStockPrevClose,
} from '../lib/capitalPeriodMetrics';
import { fetchMarketRateRub, prefetchCryptoHistoryCharts, prefetchMarketHistoryForPeriod } from '../lib/marketRates';
import {
  getMarketAssetDisplay,
  aggregateAssetsSectionMetrics,
  buildCapitalAllocation,
  resolveAssetDynamicsInsight,
} from '../lib/capitalAssetDisplay';
import type { CapitalAsset } from '../types';
import { useAppTheme } from '../contexts/ThemeContext';
import { CapitalCurrencyProvider } from '../contexts/CapitalCurrencyContext';
import { useThemedStyles } from '../theme/useThemedStyles';

function isCompactMarketAsset(item: CapitalAsset) {
  return item.assetType === 'stocks' || item.assetType === 'crypto' || item.assetType === 'bonds';
}

function getAssetsForFilter(items: CapitalAsset[], filter: CapitalAssetFilter) {
  const filtered = filter === 'all' ? items : items.filter((item) => item.assetType === filter);
  return {
    stockItems: filtered.filter((item) => item.assetType === 'stocks'),
    bondItems: filtered.filter((item) => item.assetType === 'bonds'),
    cryptoItems: filtered.filter((item) => item.assetType === 'crypto'),
    manualItems: filtered.filter((item) => !isCompactMarketAsset(item)),
  };
}

function isFilterPageEmpty(buckets: ReturnType<typeof getAssetsForFilter>) {
  return (
    buckets.stockItems.length === 0 &&
    buckets.bondItems.length === 0 &&
    buckets.cryptoItems.length === 0 &&
    buckets.manualItems.length === 0
  );
}

function filterPageShowsHistoryPeriod(items: CapitalAsset[], filter: CapitalAssetFilter) {
  return items
    .filter((item) => item.assetType === filter)
    .some((item) => isCompactMarketAsset(item));
}

const SPOT_REFRESH_INTERVAL_MS = 120_000;
const ALL_HISTORY_PERIODS: CapitalHistoryPeriod[] = ['d1', 'd365'];
/** Фиксированный слот — высота не меняется при свайпе, только opacity. */
const PERIOD_ROW_SLOT_HEIGHT = 24;

function marketAssetExpectsIntradayDynamics(item: CapitalAsset) {
  return (
    item.isActive &&
    (item.assetType === 'stocks' || item.assetType === 'crypto' || item.assetType === 'bonds')
  );
}

export function CapitalScreen() {
  const { colors } = useAppTheme();
  const { width: screenWidth } = useWindowDimensions();
  const pagerScrollX = useRef(new Animated.Value(0)).current;
  const assetsPagerRef = useRef<CapitalAssetsPagerHandle>(null);
  const [items, setItems] = useState<CapitalAsset[]>([]);
  const [valuations, setValuations] = useState<Record<string, AssetValuation>>({});
  const [insightsByPeriod, setInsightsByPeriod] = useState<
    Partial<Record<CapitalHistoryPeriod, Record<string, RateHistoryInsight>>>
  >({});
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);
  const [assetFilter, setAssetFilter] = useState<CapitalAssetFilter>('stocks');
  const [historyPeriod, setHistoryPeriod] = useState<CapitalHistoryPeriod>('d1');
  const [historyChartsReady, setHistoryChartsReady] = useState(false);
  const [loadingPeriod, setLoadingPeriod] = useState<CapitalHistoryPeriod | null>(null);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<Date | null>(null);
  const [ratesLabelTick, setRatesLabelTick] = useState(0);
  const [assetPagerHeight, setAssetPagerHeight] = useState(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const valuationsRef = useRef(valuations);
  valuationsRef.current = valuations;
  const insightsByPeriodRef = useRef(insightsByPeriod);
  insightsByPeriodRef.current = insightsByPeriod;
  const historyPeriodRef = useRef(historyPeriod);
  historyPeriodRef.current = historyPeriod;
  const historyChartsReadyRef = useRef(historyChartsReady);
  historyChartsReadyRef.current = historyChartsReady;

  const historyInsights = useMemo(
    () => insightsByPeriod[historyPeriod] ?? {},
    [insightsByPeriod, historyPeriod]
  );

  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      screenBody: {
        flex: 1,
        paddingHorizontal: 16,
      },
      headerBlock: {
        flexGrow: 0,
        paddingTop: 8,
        paddingBottom: 2,
      },
      headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
      },
      screenTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: c.text,
        letterSpacing: -0.5,
      },
      headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      },
      iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceMuted,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      iconButtonDisabled: { opacity: 0.5 },
      addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: c.accent,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.soft,
      },
      empty: {
        paddingVertical: 28,
        paddingHorizontal: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: c.borderLight,
        borderStyle: 'dashed',
        borderRadius: radii.lg,
        backgroundColor: c.surfaceMuted,
      },
      emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: c.text,
        marginBottom: 6,
        textAlign: 'center',
      },
      emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
      marketSection: { marginBottom: 10 },
      marketSectionCard: {
        backgroundColor: c.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: c.borderLight,
        overflow: 'hidden',
        ...shadows.soft,
      },
      categoryChromeWrap: {
        alignSelf: 'stretch',
        alignItems: 'center',
        marginTop: 2,
        marginBottom: 8,
      },
      periodRowSlot: {
        alignSelf: 'stretch',
        height: PERIOD_ROW_SLOT_HEIGHT,
        marginTop: 4,
        justifyContent: 'center',
      },
      periodRowAnimated: {
        alignSelf: 'stretch',
      },
      periodRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        alignSelf: 'stretch',
      },
      assetPagerWrap: {
        flex: 1,
        marginHorizontal: -16,
      },
      assetPageScroll: {
        flex: 1,
        width: '100%',
      },
      assetPageContent: {
        paddingHorizontal: 16,
        paddingBottom: 32,
      },
    })
  );

  const mergeMarketFields = useCallback(
    (rows: CapitalAsset[], nextValuations: Record<string, AssetValuation>) =>
      rows.map((row) => {
        const valuation = nextValuations[row.id];
        if (row.valuationMode !== 'market' || !valuation) return row;
        if (
          !valuation.rateRubPerUnit ||
          (valuation.source !== 'moex' &&
            valuation.source !== 'coingecko' &&
            valuation.source !== 'cached')
        ) {
          return row;
        }
        return {
          ...row,
          amount: valuation.valueRub,
          marketValueRub: valuation.valueRub,
          marketRateRub: valuation.rateRubPerUnit,
          marketFetchedAt: valuation.fetchedAt ?? row.marketFetchedAt,
        };
      }),
    []
  );

  const applyFetchedValuations = useCallback(
    (rows: CapitalAsset[], fetched: Record<string, AssetValuation>) => {
      let merged: Record<string, AssetValuation> = {};
      setValuations((prev) => {
        merged = mergeFreshMoexValuations(prev, fetched);
        return merged;
      });
      setItems((prev) => {
        const rowIds = new Set(rows.map((row) => row.id));
        const extras = prev.filter((row) => !rowIds.has(row.id));
        return mergeMarketFields([...extras, ...rows], merged);
      });
      return merged;
    },
    [mergeMarketFields]
  );

  const patchPeriodInsights = useCallback(
    (period: CapitalHistoryPeriod, insights: Record<string, RateHistoryInsight>) => {
      setInsightsByPeriod((prev) => ({ ...prev, [period]: insights }));
    },
    []
  );

  const mergeValuationsIntoAllPeriodInsights = useCallback(
    (mergedValuations: Record<string, AssetValuation>) => {
      const rows = itemsRef.current;
      setInsightsByPeriod((prev) => {
        const next = { ...prev };
        for (const period of ALL_HISTORY_PERIODS) {
          const days = getHistoryPeriodDays(period);
          if (period === 'd1') {
            const fresh = buildHistoryInsightsFromCache(rows, mergedValuations, days, prev[period] ?? {});
            next[period] = fresh;
            continue;
          }
          if (next[period]) {
            next[period] = mergePeriodMetricsWithValuations(next[period]!, mergedValuations);
          }
        }
        return next;
      });
    },
    []
  );

  const loadPeriodInsights = useCallback(
    async (
      rows: CapitalAsset[],
      nextValuations: Record<string, AssetValuation>,
      period: CapitalHistoryPeriod
    ) => {
      const days = getHistoryPeriodDays(period);
      const { insights } = await loadCapitalHistoryInsights(rows, nextValuations, days);
      patchPeriodInsights(
        period,
        mergeHistoryInsights(insightsByPeriodRef.current[period] ?? {}, insights)
      );
      return insights;
    },
    [patchPeriodInsights]
  );

  const prefetchHistoryCache = useCallback(async (rows: CapitalAsset[]) => {
    const market = collectMarketAssetsForHistory(rows);
    const cryptoUnits = [
      ...new Set(
        market
          .filter((item) => item.assetType === 'crypto' || isCryptoMarketUnit(item.unit!))
          .map((item) => canonicalizeCryptoUnit(item.unit!))
      ),
    ];
    const stockTickers = [
      ...new Set(
        market
          .filter((item) => item.assetType === 'stocks' || item.assetType === 'bonds')
          .map((item) => resolveMoexTicker(item.unit!))
      ),
    ];

    const coingeckoIds = [
      ...new Set(
        cryptoUnits
          .map((unit) => resolveCoingeckoId(unit))
          .filter((id): id is string => Boolean(id))
      ),
    ];

    await Promise.all([
      prefetchMarketHistoryForPeriod(cryptoUnits, stockTickers, 1),
      prefetchMarketHistoryForPeriod(cryptoUnits, stockTickers, 365),
      coingeckoIds.length > 0 ? prefetchCryptoHistoryCharts(coingeckoIds) : null,
    ]);
  }, []);

  const applyInsightsFromCache = useCallback(
    (rows: CapitalAsset[], nextValuations: Record<string, AssetValuation>) => {
      for (const period of ALL_HISTORY_PERIODS) {
        const days = getHistoryPeriodDays(period);
        patchPeriodInsights(
          period,
          buildHistoryInsightsFromCache(
            rows,
            nextValuations,
            days,
            insightsByPeriodRef.current[period] ?? {}
          )
        );
      }
      setHistoryChartsReady(true);
    },
    [patchPeriodInsights]
  );

  const hydrateHistoryInsights = useCallback(
    async (rows: CapitalAsset[], nextValuations: Record<string, AssetValuation>) => {
      await prefetchIntradayStockPrevClose(rows);
      applyInsightsFromCache(rows, nextValuations);

      try {
        await prefetchHistoryCache(rows);
        applyInsightsFromCache(rows, nextValuations);
      } catch (error) {
        console.warn('Capital history prefetch failed', error);
      }

      await loadPeriodInsights(rows, nextValuations, 'd1');
      void loadPeriodInsights(rows, nextValuations, 'd365');
    },
    [prefetchHistoryCache, applyInsightsFromCache, loadPeriodInsights]
  );

  const refreshRatesOnly = useCallback(
    async (options?: { silent?: boolean }) => {
      const rows = itemsRef.current;
      const hasMarket = rows.some((item) => item.isActive && item.valuationMode === 'market');
      if (!hasMarket) return;

      if (!options?.silent) {
        setIsRefreshingRates(true);
      }

      try {
        const fetched = await buildCapitalValuations(rows, { forceMoex: true });
        const merged = applyFetchedValuations(rows, fetched);
        mergeValuationsIntoAllPeriodInsights(merged);
        if (historyChartsReadyRef.current) {
          applyInsightsFromCache(rows, merged);
        }
        setRatesUpdatedAt(new Date());

        void persistCapitalMarketSnapshots(collectMarketSnapshots(rows, merged)).catch(
          (error) => {
            console.warn('persistCapitalMarketSnapshots failed', error);
          }
        );
      } finally {
        if (!options?.silent) {
          setIsRefreshingRates(false);
        }
      }
    },
    [applyFetchedValuations, mergeValuationsIntoAllPeriodInsights, applyInsightsFromCache]
  );

  const refreshSpotValuations = useCallback(
    async (rows: CapitalAsset[]) => {
      const fetched = await buildCapitalValuations(rows, { forceMoex: true });
      const merged = applyFetchedValuations(rows, fetched);

      const snapshots = collectMarketSnapshots(rows, merged);
      void persistCapitalMarketSnapshots(snapshots).catch((error) => {
        console.warn('persistCapitalMarketSnapshots failed', error);
      });
      void recordValuationSnapshotsIfDue(rows, merged).catch((error) => {
        console.warn('recordValuationSnapshotsIfDue failed', error);
      });

      return merged;
    },
    [applyFetchedValuations]
  );

  const handleRefreshRates = useCallback(async () => {
    await refreshRatesOnly();
  }, [refreshRatesOnly]);

  const refreshValuations = useCallback(
    async (rows: CapitalAsset[]) => {
      const nextValuations = await refreshSpotValuations(rows);
      if (historyChartsReadyRef.current) {
        applyInsightsFromCache(rows, nextValuations);
      }
      void hydrateHistoryInsights(rows, nextValuations);
      return nextValuations;
    },
    [refreshSpotValuations, applyInsightsFromCache, hydrateHistoryInsights]
  );

  const load = useCallback(async () => {
    // 1) Локальный персистентный кэш истории — основа для мгновенной динамики.
    await ensureHistoricalCacheHydrated();

    // 2) Активы из БД содержат последние сохранённые котировки.
    const rows = await fetchCapitalAssets();
    setItems(rows);

    // 3) Мгновенный кадр: суммы и динамика из последних известных данных, без сети.
    const cachedValuations = buildCachedValuations(rows);
    const mergedCached = applyFetchedValuations(rows, cachedValuations);
    applyInsightsFromCache(rows, mergedCached);
    const storedAt = latestStoredFetchedAt(rows);
    if (storedAt) setRatesUpdatedAt(storedAt);

    // 4) Живые котировки — поверх мгновенного кадра.
    const nextValuations = await refreshSpotValuations(rows);
    setRatesUpdatedAt(new Date());
    applyInsightsFromCache(rows, nextValuations);
    void hydrateHistoryInsights(rows, nextValuations);
  }, [
    applyFetchedValuations,
    refreshSpotValuations,
    applyInsightsFromCache,
    hydrateHistoryInsights,
  ]);

  const handleHistoryPeriodChange = useCallback(
    (period: CapitalHistoryPeriod) => {
      setHistoryPeriod(period);

      const rows = itemsRef.current;
      const vals = valuationsRef.current;
      const days = getHistoryPeriodDays(period);
      const existing = insightsByPeriodRef.current[period] ?? {};

      if (historyChartsReady) {
        const rebuilt = rebuildRateHistoryInsightsFromCache(rows, vals, days, existing);
        patchPeriodInsights(period, rebuilt);

        const market = collectMarketAssetsForHistory(rows);
        const missingCount = market.filter((asset) => !rebuilt[asset.id]).length;
        if (missingCount > 0) {
          void loadPeriodInsights(rows, vals, period);
        }
        return;
      }

      setLoadingPeriod(period);
      void (async () => {
        try {
          await prefetchHistoryCache(rows);
          setHistoryChartsReady(true);
          patchPeriodInsights(
            period,
            rebuildRateHistoryInsightsFromCache(rows, vals, days, existing)
          );
          await loadPeriodInsights(rows, vals, period);
        } finally {
          setLoadingPeriod(null);
        }
      })();
    },
    [historyChartsReady, prefetchHistoryCache, patchPeriodInsights, loadPeriodInsights]
  );

  useEffect(() => {
    if (!ratesUpdatedAt) return;
    const id = setInterval(() => setRatesLabelTick((tick) => tick + 1), 15_000);
    return () => clearInterval(id);
  }, [ratesUpdatedAt]);

  const loadRef = useRef(load);
  loadRef.current = load;
  const refreshRatesOnlyRef = useRef(refreshRatesOnly);
  refreshRatesOnlyRef.current = refreshRatesOnly;

  useFocusEffect(
    useCallback(() => {
      void loadRef.current();

      const interval = setInterval(() => {
        void refreshRatesOnlyRef.current({ silent: true });
      }, SPOT_REFRESH_INTERVAL_MS);

      const appStateSub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          void refreshRatesOnlyRef.current({ silent: true });
        }
      });

      return () => {
        clearInterval(interval);
        appStateSub.remove();
      };
    }, [])
  );

  const ratesUpdatedLabel = useMemo(() => {
    if (!ratesUpdatedAt) return isRefreshingRates ? 'Обновляем котировки…' : '';
    if (isRefreshingRates) return 'Обновляем котировки…';
    const diffSec = Math.floor((Date.now() - ratesUpdatedAt.getTime()) / 1000);
    if (diffSec < 10) return 'Котировки обновлены только что · авто каждые 2 мин';
    if (diffSec < 60) return `Котировки обновлены ${diffSec} с назад · авто каждые 2 мин`;
    const min = Math.floor(diffSec / 60);
    return `Котировки обновлены ${min} мин назад · авто каждые 2 мин`;
  }, [ratesUpdatedAt, isRefreshingRates, ratesLabelTick]);

  const activeTotal = useMemo(
    () => getCapitalTotal(items, valuations),
    [items, valuations]
  );

  const allocation = useMemo(
    () => buildCapitalAllocation(items, valuations),
    [items, valuations]
  );

  const portfolioDay = useMemo(
    () => aggregateAssetsSectionMetrics(items, valuations, insightsByPeriod['d1'] ?? {}, 'd1'),
    [items, valuations, insightsByPeriod]
  );

  const heroDayChange = useMemo(
    () =>
      portfolioDay.insight
        ? {
            changeRub: portfolioDay.insight.changeRub,
            changePercent: portfolioDay.insight.changePercent,
          }
        : null,
    [portfolioDay]
  );

  const heroDayLoading =
    portfolioDay.dynamicsExpected > 0 && portfolioDay.dynamicsResolved === 0;

  const hasLiveAssets = useMemo(
    () => items.some((item) => item.valuationMode === 'market' && item.isActive),
    [items]
  );

  const heroRatesHint = useMemo(() => {
    if (!hasLiveAssets) return null;
    if (isRefreshingRates) return 'Обновляем котировки…';
    if (!ratesUpdatedAt) return 'MOEX · CoinGecko · ЦБ РФ';
    const diffSec = Math.floor((Date.now() - ratesUpdatedAt.getTime()) / 1000);
    if (diffSec < 60) return 'Котировки только что · MOEX · CoinGecko';
    const min = Math.floor(diffSec / 60);
    return `Котировки ${min} мин назад · MOEX · CoinGecko`;
  }, [hasLiveAssets, isRefreshingRates, ratesUpdatedAt, ratesLabelTick]);

  const brokerConnectionIds = useMemo(() => getBrokerConnectionIds(items), [items]);

  const assetFilterOptions = useMemo(() => buildAssetFilterOptions(items), [items]);
  const filterPages = useMemo(
    () => assetFilterOptions.map((option) => option.value),
    [assetFilterOptions]
  );

  const activeFilterIndex = useMemo(() => {
    const index = assetFilterOptions.findIndex((option) => option.value === assetFilter);
    return index >= 0 ? index : 0;
  }, [assetFilterOptions, assetFilter]);

  const handlePagerPageChange = useCallback(
    (index: number) => {
      const option = assetFilterOptions[index];
      if (option) setAssetFilter(option.value);
    },
    [assetFilterOptions]
  );

  const handleCategorySelect = useCallback(
    (filter: CapitalAssetFilter) => {
      const index = assetFilterOptions.findIndex((option) => option.value === filter);
      if (index >= 0) assetsPagerRef.current?.scrollToPage(index);
    },
    [assetFilterOptions]
  );

  const activeFilterIndexRef = useRef(activeFilterIndex);
  activeFilterIndexRef.current = activeFilterIndex;
  const filterPagesLengthRef = useRef(filterPages.length);
  filterPagesLengthRef.current = filterPages.length;

  const categorySwipePan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.4,
      onPanResponderRelease: (_, gesture) => {
        const pages = filterPagesLengthRef.current;
        if (pages <= 1) return;
        const current = activeFilterIndexRef.current;
        if (gesture.dx < -48) {
          const next = Math.min(current + 1, pages - 1);
          if (next !== current) assetsPagerRef.current?.scrollToPage(next);
        } else if (gesture.dx > 48) {
          const next = Math.max(current - 1, 0);
          if (next !== current) assetsPagerRef.current?.scrollToPage(next);
        }
      },
    })
  ).current;

  const handleBrokerSync = useCallback(async () => {
    if (brokerConnectionIds.length === 0) return;

    try {
      const results = await Promise.all(
        brokerConnectionIds.map((connectionId) => requestTInvestSync(connectionId))
      );
      const failed = results.find((result) => !result.ok);
      if (failed) {
        Alert.alert('Синхронизация', failed.message ?? 'Не удалось обновить портфель T-Invest');
        return;
      }
      await load();
      Alert.alert('Готово', results[0]?.message ?? 'Портфель T-Invest обновлён');
    } catch (error) {
      Alert.alert(
        'Ошибка',
        error instanceof Error ? error.message : 'Не удалось синхронизировать T-Invest'
      );
    }
  }, [brokerConnectionIds, load]);

  useEffect(() => {
    if (assetFilterOptions.length === 0) return;
    const stillAvailable = assetFilterOptions.some((option) => option.value === assetFilter);
    if (!stillAvailable || assetFilter === 'all') {
      setAssetFilter(assetFilterOptions[0].value);
    }
  }, [assetFilter, assetFilterOptions]);

  const handleAddAsset = async (payload: AddCapitalAssetPayload) => {
    if (payload.kind === 'market') {
      const rate = await fetchMarketRateRub(payload.unit, payload.assetType);
      if (rate == null || rate <= 0) {
        throw new Error('Не удалось получить актуальную цену. Попробуйте позже.');
      }

      const valueRub = Math.round(payload.quantity * rate * 100) / 100;
      const fetchedAt = new Date().toISOString();
      const { asset, merged } = await insertOrMergeCapitalAsset(
        {
          name: payload.name,
          assetType: payload.assetType,
          valuationMode: 'market',
          amount: valueRub,
          quantity: payload.quantity,
          unit: payload.unit,
          marketRateRub: rate,
          marketValueRub: valueRub,
          marketFetchedAt: fetchedAt,
        },
        items
      );
      const next = merged
        ? items.map((row) => (row.id === asset.id ? asset : row))
        : [asset, ...items];

      const source: AssetValuation['source'] =
        payload.assetType === 'crypto'
          ? 'coingecko'
          : payload.assetType === 'stocks'
            ? 'moex'
            : isFxUnit(payload.unit)
              ? 'cbr'
              : 'manual';
      const optimistic: AssetValuation = {
        valueRub,
        rateRubPerUnit: rate,
        quantity: payload.quantity,
        unit: payload.unit,
        unitSymbol: getUnitSymbol(payload.unit),
        source,
        fetchedAt,
      };

      setItems(next);
      itemsRef.current = next;
      setValuations((prev) => mergeFreshMoexValuations(prev, { [asset.id]: optimistic }));
      setRatesUpdatedAt(new Date());

      void persistCapitalMarketSnapshots(
        collectMarketSnapshots(next, { [asset.id]: optimistic })
      ).catch((error) => {
        console.warn('persistCapitalMarketSnapshots failed', error);
      });

      // Тот же полный цикл обновления, что и раньше — только в фоне, без блокировки кнопки.
      void refreshValuations(next);
      return;
    }

    const created = await insertCapitalAsset({
      name: payload.name,
      assetType: payload.assetType,
      valuationMode: 'manual',
      amount: payload.amount,
    });
    setItems((prev) => [created, ...prev]);
  };

  const handleToggle = (item: CapitalAsset, next: boolean) => {
    setItems((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, isActive: next } : row))
    );
    void setCapitalAssetActive(item.id, next).catch((error) => {
      setItems((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, isActive: !next } : row))
      );
      Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось обновить.');
    });
  };

  const handleUpdate = (item: CapitalAsset) => {
    if (isBrokerSyncedAsset(item)) {
      Alert.alert(
        'Брокерский актив',
        'Количество обновляется из T-Invest. Нажмите «Синхронизировать T-Invest» на экране капитала.',
        [
          { text: 'Отмена', style: 'cancel' },
          { text: 'Синхронизировать', onPress: () => void handleBrokerSync() },
        ]
      );
      return;
    }

    if (!Alert.prompt) {
      Alert.alert('Обновление', 'Удалите актив и добавьте заново с новым значением.');
      return;
    }

    if (item.valuationMode === 'market' && item.quantity && item.unit) {
      Alert.prompt(
        'Обновить количество',
        `${item.name} · сейчас ${formatQuantityLabel(item.quantity, item.unit)}`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Сохранить',
            onPress: (text?: string) => {
              const value = Number((text ?? '').replace(',', '.'));
              if (!value || value <= 0) {
                Alert.alert('Ошибка', 'Введите корректное количество.');
                return;
              }
              void (async () => {
                try {
                  await updateCapitalAssetQuantity(item.id, value);
                  const next = items.map((row) =>
                    row.id === item.id ? { ...row, quantity: value } : row
                  );
                  setItems(next);
                  await refreshValuations(next);
                } catch (error) {
                  Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось обновить.');
                }
              })();
            },
          },
        ],
        'plain-text',
        String(item.quantity)
      );
      return;
    }

    Alert.prompt(
      'Обновить сумму',
      `${item.name} · сейчас ₽${item.amount.toLocaleString('ru-RU')}`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Сохранить',
          onPress: (text?: string) => {
            const value = Number((text ?? '').replace(',', '.'));
            if (!value || value <= 0) {
              Alert.alert('Ошибка', 'Введите корректную сумму.');
              return;
            }
            setItems((prev) =>
              prev.map((row) => (row.id === item.id ? { ...row, amount: value } : row))
            );
            void updateCapitalAssetAmount(item.id, value).catch((error) => {
              void load();
              Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось обновить.');
            });
          },
        },
      ],
      'plain-text',
      String(Math.round(item.amount))
    );
  };

  const handleDelete = (item: CapitalAsset) => {
    Alert.alert('Удалить актив?', item.name, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          setItems((prev) => prev.filter((row) => row.id !== item.id));
          void deleteCapitalAsset(item.id).catch((error) => {
            void load();
            Alert.alert('Ошибка', error instanceof Error ? error.message : 'Не удалось удалить.');
          });
        },
      },
    ]);
  };

  const openAssetActions = (item: CapitalAsset) => {
    const { title } = getMarketAssetDisplay(item);
    const broker = isBrokerSyncedAsset(item);
    const actions = broker
      ? [
          {
            text: 'Обновить из T-Invest',
            onPress: () => void handleBrokerSync(),
          },
        ]
      : [
          {
            text:
              isCompactMarketAsset(item) || item.valuationMode === 'market'
                ? 'Изменить количество'
                : 'Обновить сумму',
            onPress: () => handleUpdate(item),
          },
        ];

    Alert.alert(title, undefined, [
      ...actions,
      {
        text: item.isActive ? 'Скрыть из суммы' : 'Учитывать в капитале',
        onPress: () => handleToggle(item, !item.isActive),
      },
      { text: 'Удалить', style: 'destructive', onPress: () => handleDelete(item) },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const hasAnyPeriodPage = useMemo(
    () => filterPages.some((page) => filterPageShowsHistoryPeriod(items, page)),
    [filterPages, items]
  );

  const periodScrollReveal = useMemo(() => {
    if (filterPages.length === 0 || screenWidth <= 0) return null;
    if (filterPages.length === 1) {
      return filterPageShowsHistoryPeriod(items, filterPages[0]) ? 1 : 0;
    }

    const inputRange = filterPages.map((_, index) => index * screenWidth);
    const outputRange = filterPages.map((page) =>
      filterPageShowsHistoryPeriod(items, page) ? 1 : 0
    );

    return pagerScrollX.interpolate({
      inputRange,
      outputRange,
      extrapolate: 'clamp',
    });
  }, [filterPages, items, pagerScrollX, screenWidth]);

  const periodVisibleForInteraction = useMemo(
    () => filterPageShowsHistoryPeriod(items, assetFilter),
    [items, assetFilter]
  );

  const renderFixedCategoryChrome = () => {
    const hasCategories = assetFilterOptions.length > 0;
    if (!hasCategories && !hasAnyPeriodPage) return null;

    const periodOpacityStyle =
      periodScrollReveal == null
        ? null
        : typeof periodScrollReveal === 'number'
          ? { opacity: periodScrollReveal }
          : { opacity: periodScrollReveal };

    return (
      <View style={styles.categoryChromeWrap} {...categorySwipePan.panHandlers}>
        {hasCategories ? (
          <CapitalCategoryCarousel
            options={assetFilterOptions}
            value={assetFilter}
            onChange={handleCategorySelect}
            scrollX={pagerScrollX}
            pageWidth={screenWidth}
          />
        ) : null}
        {hasAnyPeriodPage && periodOpacityStyle ? (
          <View
            style={styles.periodRowSlot}
            pointerEvents={periodVisibleForInteraction ? 'box-none' : 'none'}
          >
            <Animated.View style={[styles.periodRowAnimated, periodOpacityStyle]}>
              <View style={styles.periodRow}>
                <CapitalHistoryPeriodToggle
                  value={historyPeriod}
                  onChange={handleHistoryPeriodChange}
                />
              </View>
            </Animated.View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderMarketSection = (sectionItems: CapitalAsset[]) => {
    if (sectionItems.length === 0) return null;

    const sectionMetrics = aggregateAssetsSectionMetrics(
      sectionItems,
      valuations,
      historyInsights,
      historyPeriod
    );
    const sectionHistoryLoading =
      loadingPeriod === historyPeriod &&
      sectionMetrics.dynamicsExpected > sectionMetrics.dynamicsResolved;

    return (
      <View style={styles.marketSection}>
        <View style={styles.marketSectionCard}>
          {sectionMetrics.activeCount > 0 ? (
            <CapitalSectionSummary
              metrics={sectionMetrics}
              historyLoading={sectionHistoryLoading}
            />
          ) : null}
          {sectionItems.map((item, index) => {
            const resolvedInsight = resolveAssetDynamicsInsight(
              item,
              valuations[item.id],
              historyInsights[item.id],
              historyPeriod
            );
            const expectsDynamics = marketAssetExpectsIntradayDynamics(item);
            const rowHistoryLoading =
              loadingPeriod === historyPeriod && expectsDynamics && !resolvedInsight;

            return (
            <CapitalMarketAssetRow
              key={item.id}
              item={item}
              valuation={valuations[item.id]}
              history={resolvedInsight}
              historyLoading={rowHistoryLoading}
              isLast={index === sectionItems.length - 1}
              onPress={() => openAssetActions(item)}
            />
            );
          })}
        </View>
      </View>
    );
  };

  const renderAssetsPage = (filter: CapitalAssetFilter) => {
      const buckets = getAssetsForFilter(items, filter);
      const manualMetrics =
        buckets.manualItems.length > 0
          ? aggregateAssetsSectionMetrics(
              buckets.manualItems,
              valuations,
              historyInsights,
              historyPeriod
            )
          : null;

      if (isFilterPageEmpty(buckets)) {
        return (
          <ScrollView
            style={styles.assetPageScroll}
            contentContainerStyle={styles.assetPageContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            <View style={styles.empty}>
              <Text style={styles.emptyText}>В этой категории пока нет активов</Text>
            </View>
          </ScrollView>
        );
      }

      return (
        <ScrollView
          style={styles.assetPageScroll}
          contentContainerStyle={styles.assetPageContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {renderMarketSection(buckets.stockItems)}
          {renderMarketSection(buckets.bondItems)}
          {renderMarketSection(buckets.cryptoItems)}

          {buckets.manualItems.length > 0 ? (
            <View style={styles.marketSection}>
              <View style={styles.marketSectionCard}>
                {manualMetrics && manualMetrics.activeCount > 0 ? (
                  <CapitalSectionSummary metrics={manualMetrics} />
                ) : null}
                {buckets.manualItems.map((item, index) => (
                  <CapitalManualAssetRow
                    key={item.id}
                    item={item}
                    valuation={valuations[item.id]}
                    isLast={index === buckets.manualItems.length - 1}
                    onPress={() => openAssetActions(item)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      );
  };

  return (
    <CapitalCurrencyProvider>
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.screenBody}>
        <View style={styles.headerBlock}>
          <View style={styles.headerRow}>
            <Text style={styles.screenTitle}>Капитал</Text>
            <View style={styles.headerActions}>
              {hasLiveAssets ? (
                <TouchableOpacity
                  style={[styles.iconButton, isRefreshingRates && styles.iconButtonDisabled]}
                  onPress={() => void handleRefreshRates()}
                  disabled={isRefreshingRates}
                  accessibilityRole="button"
                  accessibilityLabel={ratesUpdatedLabel || 'Обновить курсы'}
                >
                  {isRefreshingRates ? (
                    <ActivityIndicator color={colors.accent} size="small" />
                  ) : (
                    <Ionicons name="refresh" size={18} color={colors.accentDark} />
                  )}
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setAddSheetVisible(true)}
                accessibilityLabel="Добавить актив"
              >
                <Ionicons name="add" size={22} color={colors.textOnAccent} />
              </TouchableOpacity>
            </View>
          </View>

          {activeTotal > 0 ? (
            <CapitalHeroCard
              total={activeTotal}
              dayChange={heroDayChange}
              dayChangeLoading={heroDayLoading}
              allocation={allocation}
              ratesHint={heroRatesHint}
            />
          ) : null}

          {items.length > 0 ? renderFixedCategoryChrome() : null}
        </View>

        {items.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.assetPageContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Портфель пуст</Text>
              <Text style={styles.emptyText}>
                Добавьте первый актив — акции, вклад, крипту или недвижимость.
              </Text>
            </View>
          </ScrollView>
        ) : (
          <View
            style={styles.assetPagerWrap}
            onLayout={(event) => {
              const height = Math.round(event.nativeEvent.layout.height);
              if (height > 0 && height !== assetPagerHeight) {
                setAssetPagerHeight(height);
              }
            }}
          >
            <CapitalAssetsPager
              ref={assetsPagerRef}
              pages={filterPages}
              pageWidth={screenWidth}
              pageHeight={assetPagerHeight}
              activeIndex={activeFilterIndex}
              onPageChange={handlePagerPageChange}
              scrollX={pagerScrollX}
              renderPage={(filter) => renderAssetsPage(filter)}
            />
          </View>
        )}
      </View>

      <AddCapitalAssetSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        onSubmit={handleAddAsset}
      />
    </SafeAreaView>
    </CapitalCurrencyProvider>
  );
}
