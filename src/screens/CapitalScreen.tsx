import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { CAPITAL_ASSET_TYPES, getCapitalAssetTypeLabel } from '../constants/capitalTypes';
import {
  CRYPTO_QUICK_PICKS,
  FX_UNITS,
  STOCK_QUICK_PICKS,
  getUnitSymbol,
  normalizeStockTicker,
} from '../constants/marketUnits';
import { MarketSearchPicker } from '../components/MarketSearchPicker';
import {
  searchCoingeckoCoins,
  searchMoexStocks,
  type MarketSearchItem,
} from '../lib/marketSearch';
import {
  deleteCapitalAsset,
  fetchCapitalAssets,
  getCapitalTotal,
  insertCapitalAsset,
  persistCapitalMarketSnapshots,
  setCapitalAssetActive,
  updateCapitalAssetAmount,
  updateCapitalAssetQuantity,
} from '../lib/capital';
import {
  buildCapitalValuations,
  collectMarketSnapshots,
  formatQuantityLabel,
  formatRateLabel,
  formatValuationAge,
  type AssetValuation,
} from '../lib/capitalValuation';
import {
  buildRateHistoryInsights,
  formatRateHistoryInsight,
  recordValuationSnapshotsIfDue,
  type RateHistoryInsight,
} from '../lib/capitalHistory';
import { fetchMarketRateRub } from '../lib/marketRates';
import type { CapitalAsset, CapitalAssetType } from '../types';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

function usesMarketValuation(type: CapitalAssetType) {
  return type === 'crypto' || type === 'cash' || type === 'stocks';
}

function defaultUnitForType(type: CapitalAssetType): string | undefined {
  if (type === 'crypto') return 'btc';
  if (type === 'cash') return 'usd';
  if (type === 'stocks') return 'vkco';
  return undefined;
}

export function CapitalScreen() {
  const { colors } = useAppTheme();
  const [items, setItems] = useState<CapitalAsset[]>([]);
  const [valuations, setValuations] = useState<Record<string, AssetValuation>>({});
  const [historyInsights, setHistoryInsights] = useState<Record<string, RateHistoryInsight>>({});
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [assetType, setAssetType] = useState<CapitalAssetType>('deposit');
  const [marketUnit, setMarketUnit] = useState('btc');
  const [marketSearchSelection, setMarketSearchSelection] = useState<MarketSearchItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingRates, setIsRefreshingRates] = useState(false);

  const isMarketForm = usesMarketValuation(assetType);
  const quickPickOptions =
    assetType === 'crypto'
      ? CRYPTO_QUICK_PICKS
      : assetType === 'cash'
        ? FX_UNITS
        : STOCK_QUICK_PICKS;

  const resolvedMarketUnit = useMemo(() => {
    if (marketSearchSelection) return marketSearchSelection.unit;
    if (assetType === 'stocks') return normalizeStockTicker(marketUnit);
    return marketUnit;
  }, [assetType, marketSearchSelection, marketUnit]);

  const handleMarketSearchSelect = useCallback((item: MarketSearchItem | null) => {
    setMarketSearchSelection(item);
    if (item) {
      setMarketUnit('');
      setName((prev) => (prev.trim() ? prev : item.name));
    }
  }, []);

  const handleQuickPick = useCallback((value: string) => {
    setMarketUnit(value);
    setMarketSearchSelection(null);
  }, []);

  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: c.background },
      content: { padding: 20, paddingBottom: 40 },
      backButton: { marginBottom: 8 },
      backText: { color: c.accentDark, fontSize: 16, fontWeight: '600' },
      title: { fontSize: 28, fontWeight: '800', color: c.accent, marginBottom: 6 },
      subtitle: { fontSize: 15, color: c.textMuted, marginBottom: 20, lineHeight: 21 },
      card: {
        backgroundColor: c.surface,
        borderRadius: radii.lg,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: c.borderLight,
        ...shadows.soft,
      },
      cardLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 10,
      },
      input: {
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 16,
        color: c.text,
        marginBottom: 10,
        backgroundColor: c.backgroundDeep,
      },
      types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
      chip: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.backgroundDeep,
      },
      chipActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
      chipText: { fontSize: 13, fontWeight: '600', color: c.textMuted },
      chipTextActive: { color: c.accentDark },
      saveButton: {
        backgroundColor: c.accent,
        borderRadius: radii.md,
        paddingVertical: 14,
        alignItems: 'center',
      },
      saveButtonText: { color: c.textOnAccent, fontWeight: '700', fontSize: 16 },
      refreshButton: {
        marginBottom: 16,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: radii.md,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: c.surface,
      },
      refreshButtonText: { color: c.accentDark, fontWeight: '700', fontSize: 15 },
      buttonDisabled: { opacity: 0.6 },
      itemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
      },
      itemMain: { flex: 1 },
      itemName: { fontSize: 16, fontWeight: '700', color: c.text, marginBottom: 4 },
      itemMeta: { fontSize: 13, color: c.textMuted, lineHeight: 18 },
      itemAmount: { fontSize: 17, fontWeight: '800', color: c.text },
      itemActions: { alignItems: 'flex-end', gap: 8 },
      editLink: { color: c.accentDark, fontSize: 13, fontWeight: '600' },
      deleteLink: { color: c.danger, fontSize: 13, fontWeight: '600' },
      marketBadge: {
        marginTop: 6,
        fontSize: 12,
        color: c.accentDark,
        fontWeight: '600',
      },
      empty: {
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: c.border,
        borderStyle: 'dashed',
        borderRadius: radii.lg,
      },
      emptyText: { color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
      totalHero: {
        backgroundColor: c.primarySoft,
        borderRadius: radii.lg,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: c.border,
      },
      totalHeroLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 6,
      },
      totalHeroValue: { fontSize: 30, fontWeight: '900', color: c.accent },
      totalHeroHint: { marginTop: 6, fontSize: 13, color: c.textMuted, lineHeight: 18 },
      formHint: { fontSize: 13, color: c.textMuted, lineHeight: 18, marginBottom: 10 },
      historyUp: { fontSize: 12, color: c.accentDark, fontWeight: '600', marginTop: 4 },
      historyDown: { fontSize: 12, color: c.danger, fontWeight: '600', marginTop: 4 },
      historyFlat: { fontSize: 12, color: c.textMuted, fontWeight: '600', marginTop: 4 },
    })
  );

  const mergeMarketFields = useCallback(
    (rows: CapitalAsset[], nextValuations: Record<string, AssetValuation>) =>
      rows.map((row) => {
        const valuation = nextValuations[row.id];
        if (row.valuationMode !== 'market' || !valuation) return row;
        return {
          ...row,
          amount: valuation.valueRub,
          marketValueRub: valuation.valueRub,
          marketRateRub: valuation.rateRubPerUnit ?? row.marketRateRub,
          marketFetchedAt: valuation.fetchedAt ?? row.marketFetchedAt,
        };
      }),
    []
  );

  const refreshValuations = useCallback(async (rows: CapitalAsset[]) => {
    const nextValuations = await buildCapitalValuations(rows);
    const snapshots = collectMarketSnapshots(rows, nextValuations);
    await persistCapitalMarketSnapshots(snapshots);
    await recordValuationSnapshotsIfDue(rows, nextValuations);
    const nextHistory = await buildRateHistoryInsights(rows, nextValuations);
    setValuations(nextValuations);
    setHistoryInsights(nextHistory);
    setItems(mergeMarketFields(rows, nextValuations));
    return nextValuations;
  }, [mergeMarketFields]);

  const load = useCallback(async () => {
    const rows = await fetchCapitalAssets();
    setItems(rows);
    setIsRefreshingRates(true);
    try {
      await refreshValuations(rows);
    } finally {
      setIsRefreshingRates(false);
    }
  }, [refreshValuations]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const activeTotal = useMemo(
    () => getCapitalTotal(items, valuations),
    [items, valuations]
  );

  const hasLiveAssets = useMemo(
    () => items.some((item) => item.valuationMode === 'market' && item.isActive),
    [items]
  );

  const handleTypeChange = (type: CapitalAssetType) => {
    setAssetType(type);
    const unit = defaultUnitForType(type);
    if (unit) {
      setMarketUnit(unit);
      setMarketSearchSelection(null);
    }
  };

  const handleAdd = async () => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      Alert.alert('Укажите название', 'Например: Bitcoin, Доллары, Вклад в Сбере.');
      return;
    }

    setIsSaving(true);
    try {
      if (isMarketForm) {
        const qty = Number(quantity.replace(',', '.'));
        if (!qty || qty <= 0) {
          const qtyHint =
            assetType === 'stocks'
              ? 'Введите количество акций.'
              : 'Введите, сколько монет или валюты у вас есть.';
          Alert.alert('Укажите количество', qtyHint);
          return;
        }

        const unit = resolvedMarketUnit;
        if (!unit) {
          Alert.alert(
            'Выберите инструмент',
            assetType === 'stocks'
              ? 'Начните вводить название или тикер — например «ВК» или VKCO.'
              : 'Выберите монету из списка или найдите через поиск.'
          );
          return;
        }

        const rate = await fetchMarketRateRub(unit, assetType);
        if (rate == null || rate <= 0) {
          Alert.alert('Курс недоступен', 'Не удалось получить актуальную цену. Попробуйте позже.');
          return;
        }

        const valueRub = Math.round(qty * rate * 100) / 100;
        const fetchedAt = new Date().toISOString();
        const created = await insertCapitalAsset({
          name: trimmedName,
          assetType,
          valuationMode: 'market',
          amount: valueRub,
          quantity: qty,
          unit,
          marketRateRub: rate,
          marketValueRub: valueRub,
          marketFetchedAt: fetchedAt,
        });
        const next = [created, ...items];
        setItems(next);
        await refreshValuations(next);
        setName('');
        setQuantity('');
        setMarketSearchSelection(null);
      } else {
        const value = Number(amount.replace(',', '.'));
        if (!value || value <= 0) {
          Alert.alert('Укажите сумму', 'Введите текущую стоимость актива в рублях.');
          return;
        }
        const created = await insertCapitalAsset({
          name: trimmedName,
          assetType,
          valuationMode: 'manual',
          amount: value,
        });
        setItems((prev) => [created, ...prev]);
        setName('');
        setAmount('');
        setAssetType('deposit');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить.';
      Alert.alert('Ошибка', message);
    } finally {
      setIsSaving(false);
    }
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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Капитал</Text>
        <Text style={styles.subtitle}>
          Крипта, валюта и акции переоцениваются по рынку. Остальные активы — сумма, которую вы
          указываете сами.
        </Text>

        {activeTotal > 0 ? (
          <View style={styles.totalHero}>
            <Text style={styles.totalHeroLabel}>Всего активов</Text>
            <Text style={styles.totalHeroValue}>₽{activeTotal.toLocaleString('ru-RU')}</Text>
            {hasLiveAssets ? (
              <Text style={styles.totalHeroHint}>
                Включая актуальные курсы крипты, валют и акций MOEX
              </Text>
            ) : null}
          </View>
        ) : null}

        {hasLiveAssets ? (
          <TouchableOpacity
            style={[styles.refreshButton, isRefreshingRates && styles.buttonDisabled]}
            onPress={() => void load()}
            disabled={isRefreshingRates}
          >
            {isRefreshingRates ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Text style={styles.refreshButtonText}>Обновить курсы</Text>
            )}
          </TouchableOpacity>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Добавить актив</Text>
          <TextInput
            style={styles.input}
            placeholder="Название"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />
          <View style={styles.types}>
            {CAPITAL_ASSET_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[styles.chip, assetType === type.value && styles.chipActive]}
                onPress={() => handleTypeChange(type.value)}
              >
                <Text style={[styles.chipText, assetType === type.value && styles.chipTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {isMarketForm ? (
            <>
              <Text style={styles.formHint}>
                {assetType === 'crypto'
                  ? 'Популярные монеты — кнопками ниже. Остальные — через поиск CoinGecko.'
                  : assetType === 'cash'
                    ? 'Укажите сумму в валюте — курс возьмём с сайта ЦБ РФ.'
                    : 'Начните вводить название или тикер — подсказки придут с MOEX (ВК → VKCO).'}
              </Text>
              <View style={styles.types}>
                {quickPickOptions.map((unit) => {
                  const isActive =
                    marketUnit === unit.value &&
                    (assetType === 'cash' || !marketSearchSelection);
                  return (
                    <TouchableOpacity
                      key={unit.value}
                      style={[styles.chip, isActive && styles.chipActive]}
                      onPress={() => handleQuickPick(unit.value)}
                    >
                      <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                        {unit.symbol}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {assetType === 'crypto' ? (
                <MarketSearchPicker
                  placeholder="Другая монета (PEPE, WLD, ATOM…)"
                  selected={marketSearchSelection}
                  onSelect={handleMarketSearchSelect}
                  onSearch={searchCoingeckoCoins}
                  disabled={isSaving}
                />
              ) : null}
              {assetType === 'stocks' ? (
                <MarketSearchPicker
                  placeholder="Поиск акции (ВК, Сбер, TATN…)"
                  selected={marketSearchSelection}
                  onSelect={handleMarketSearchSelect}
                  onSearch={searchMoexStocks}
                  disabled={isSaving}
                />
              ) : null}
              <TextInput
                style={styles.input}
                placeholder={
                  assetType === 'stocks' || assetType === 'crypto'
                    ? `Количество ${getUnitSymbol(resolvedMarketUnit) || '…'}`
                    : `Количество ${quickPickOptions.find((u) => u.value === marketUnit)?.symbol ?? ''}`
                }
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={quantity}
                onChangeText={setQuantity}
              />
            </>
          ) : (
            <TextInput
              style={styles.input}
              placeholder="Текущая стоимость ₽"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
          )}

          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.buttonDisabled]}
            onPress={() => void handleAdd()}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Сохраняю…' : 'Добавить'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.cardLabel}>Ваши активы</Text>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Пока нет активов. Добавьте первый выше.</Text>
          </View>
        ) : (
          items.map((item) => {
            const valuation = valuations[item.id];
            const history = historyInsights[item.id];
            const displayRub = valuation?.valueRub ?? item.amount;
            const liveUnit = item.unit;
            const liveQuantity = item.quantity;
            const isLiveAsset =
              item.valuationMode === 'market' ||
              ((item.assetType === 'crypto' ||
                item.assetType === 'cash' ||
                item.assetType === 'stocks') &&
                liveQuantity &&
                liveUnit);
            const historyStyle =
              history && history.changePercent > 0
                ? styles.historyUp
                : history && history.changePercent < 0
                  ? styles.historyDown
                  : styles.historyFlat;
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.itemRow}>
                  <View style={styles.itemMain}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMeta}>{getCapitalAssetTypeLabel(item.assetType)}</Text>
                    {isLiveAsset && liveUnit && liveQuantity ? (
                      <>
                        <Text style={styles.marketBadge}>
                          {item.assetType === 'stocks'
                            ? `${liveQuantity.toLocaleString('ru-RU', { maximumFractionDigits: 4 })} акц. ${getUnitSymbol(liveUnit)}`
                            : formatQuantityLabel(liveQuantity, liveUnit)}
                        </Text>
                        {valuation?.rateRubPerUnit ? (
                          <Text style={styles.itemMeta}>
                            {formatRateLabel(valuation.rateRubPerUnit, liveUnit, item.assetType)}
                          </Text>
                        ) : null}
                        {valuation?.fetchedAt ? (
                          <Text style={styles.itemMeta}>
                            Обновлено {formatValuationAge(valuation.fetchedAt)}
                          </Text>
                        ) : null}
                        {history ? (
                          <Text style={historyStyle}>{formatRateHistoryInsight(history)}</Text>
                        ) : isRefreshingRates ? (
                          <Text style={styles.itemMeta}>Считаем динамику за 7 дней…</Text>
                        ) : (
                          <Text style={styles.itemMeta}>
                            Динамика за 7 дней недоступна — нажмите «Обновить курсы»
                          </Text>
                        )}
                        {valuation?.error ? (
                          <Text style={[styles.itemMeta, { color: colors.danger }]}>
                            {valuation.error}
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                  </View>
                  <Text style={styles.itemAmount}>₽{displayRub.toLocaleString('ru-RU')}</Text>
                </View>
                <View style={[styles.itemRow, { marginTop: 12 }]}>
                  <Text style={styles.itemMeta}>
                    {item.isActive ? 'Учитывается в капитале' : 'Скрыт из суммы'}
                  </Text>
                  <View style={styles.itemActions}>
                    <Switch
                      value={item.isActive}
                      onValueChange={(next) => handleToggle(item, next)}
                      trackColor={{ false: colors.border, true: colors.accentSoft }}
                      thumbColor={item.isActive ? colors.accent : colors.textMuted}
                    />
                    <TouchableOpacity onPress={() => handleUpdate(item)}>
                      <Text style={styles.editLink}>
                        {item.valuationMode === 'market' ? 'Изменить количество' : 'Обновить сумму'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item)}>
                      <Text style={styles.deleteLink}>Удалить</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
