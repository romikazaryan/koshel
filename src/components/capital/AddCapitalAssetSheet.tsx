import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop } from '../ui/BottomSheetBackdrop';
import { MarketSearchPicker } from '../MarketSearchPicker';
import { CAPITAL_ASSET_TYPES } from '../../constants/capitalTypes';
import {
  CRYPTO_QUICK_PICKS,
  FX_UNITS,
  STOCK_QUICK_PICKS,
  getUnitSymbol,
  normalizeStockTicker,
} from '../../constants/marketUnits';
import { searchCoingeckoCoins, searchMoexStocks, type MarketSearchItem } from '../../lib/marketSearch';
import type { CapitalAssetType } from '../../types';
import { useSwipeDownToClose } from '../../lib/useSwipeDownToClose';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';

const AnimatedKeyboardAvoidingView = Animated.createAnimatedComponent(KeyboardAvoidingView);

function usesMarketValuation(type: CapitalAssetType) {
  return type === 'crypto' || type === 'cash' || type === 'stocks';
}

function defaultUnitForType(type: CapitalAssetType): string | undefined {
  if (type === 'crypto') return 'btc';
  if (type === 'cash') return 'usd';
  if (type === 'stocks') return 'vkco';
  return undefined;
}

function usesAutoMarketName(type: CapitalAssetType) {
  return type === 'crypto' || type === 'stocks';
}

function resolveMarketAssetName(
  assetType: CapitalAssetType,
  unit: string,
  searchSelection: MarketSearchItem | null,
  quickPicks: { value: string; label: string; symbol: string }[]
): string {
  if (searchSelection) {
    return `${searchSelection.symbol} · ${searchSelection.name}`;
  }
  const pick = quickPicks.find((item) => item.value === unit);
  if (pick) {
    return `${pick.symbol} · ${pick.label}`;
  }
  return `${getUnitSymbol(unit)} · ${assetType === 'stocks' ? 'Акция' : 'Крипта'}`;
}

export type AddCapitalAssetPayload =
  | {
      kind: 'market';
      name: string;
      assetType: CapitalAssetType;
      quantity: number;
      unit: string;
    }
  | {
      kind: 'manual';
      name: string;
      assetType: CapitalAssetType;
      amount: number;
    };

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (payload: AddCapitalAssetPayload) => Promise<void>;
};

export function AddCapitalAssetSheet({ visible, onClose, onSubmit }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { translateY, backdropOpacity, close, PanGestureHandler, panGestureProps, onScroll } =
    useSwipeDownToClose(visible, onClose, { mode: 'header' });
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [quantity, setQuantity] = useState('');
  const [assetType, setAssetType] = useState<CapitalAssetType>('stocks');
  const [marketUnit, setMarketUnit] = useState('vkco');
  const [marketSearchSelection, setMarketSearchSelection] = useState<MarketSearchItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  const resetForm = useCallback(() => {
    setName('');
    setAmount('');
    setQuantity('');
    setAssetType('stocks');
    setMarketUnit('vkco');
    setMarketSearchSelection(null);
  }, []);

  useEffect(() => {
    if (!visible) return;
    resetForm();
  }, [visible, resetForm]);

  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      overlay: {
        flex: 1,
        justifyContent: 'flex-end',
      },
      dim: {
        ...StyleSheet.absoluteFill,
        backgroundColor: c.overlay,
      },
      sheet: {
        width: '100%',
        maxHeight: '88%',
        minHeight: 520,
        backgroundColor: c.background,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        paddingBottom: Math.max(insets.bottom, 16),
        ...shadows.soft,
      },
      dragArea: {
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: 2,
      },
      handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: c.border,
      },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
      },
      title: { fontSize: 20, fontWeight: '800', color: c.text },
      closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        alignItems: 'center',
        justifyContent: 'center',
      },
      closeText: { fontSize: 22, color: c.textMuted, lineHeight: 24 },
      content: { paddingHorizontal: 20, paddingBottom: 24, flexGrow: 1 },
      cardLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
        marginBottom: 10,
        marginTop: 8,
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
      formHint: { fontSize: 13, color: c.textMuted, lineHeight: 18, marginBottom: 10 },
      saveButton: {
        backgroundColor: c.accent,
        borderRadius: radii.md,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
      },
      saveButtonText: { color: c.textOnAccent, fontWeight: '700', fontSize: 16 },
      buttonDisabled: { opacity: 0.6 },
    })
  );

  const handleTypeChange = (type: CapitalAssetType) => {
    setAssetType(type);
    const unit = defaultUnitForType(type);
    if (unit) {
      setMarketUnit(unit);
      setMarketSearchSelection(null);
    }
  };

  const handleSubmit = async () => {
    const unit = isMarketForm ? resolvedMarketUnit : undefined;
    const trimmedName = usesAutoMarketName(assetType)
      ? resolveMarketAssetName(assetType, unit ?? '', marketSearchSelection, quickPickOptions)
      : name.trim();

    if (!trimmedName) {
      Alert.alert('Укажите название', 'Например: Доллары, Вклад в Сбере.');
      return;
    }

    setIsSaving(true);
    try {
      if (isMarketForm) {
        const qty = Number(quantity.replace(',', '.'));
        if (!qty || qty <= 0) {
          Alert.alert(
            'Укажите количество',
            assetType === 'stocks'
              ? 'Введите количество акций.'
              : 'Введите, сколько монет или валюты у вас есть.'
          );
          return;
        }

        if (!unit) {
          Alert.alert(
            'Выберите инструмент',
            assetType === 'stocks'
              ? 'Начните вводить название или тикер — например «ВК» или VKCO.'
              : 'Выберите монету из списка или найдите через поиск.'
          );
          return;
        }

        await onSubmit({
          kind: 'market',
          name: trimmedName,
          assetType,
          quantity: qty,
          unit,
        });
      } else {
        const value = Number(amount.replace(',', '.'));
        if (!value || value <= 0) {
          Alert.alert('Укажите сумму', 'Введите текущую стоимость актива в рублях.');
          return;
        }
        await onSubmit({
          kind: 'manual',
          name: trimmedName,
          assetType,
          amount: value,
        });
      }
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось сохранить.';
      Alert.alert('Ошибка', message);
    } finally {
      setIsSaving(false);
    }
  };

  const showNameField = !usesAutoMarketName(assetType);

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={close}
    >
      <GestureHandlerRootView style={{ flex: 1 }} pointerEvents="box-none">
      <View style={styles.overlay} pointerEvents="box-none">
        <BottomSheetBackdrop onPress={close} opacity={backdropOpacity} />
        <AnimatedKeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheet, { transform: [{ translateY }] }]}
        >
          <PanGestureHandler {...panGestureProps}>
            <View>
              <View style={styles.dragArea}>
                <View style={styles.handle} />
              </View>
              <View style={styles.header}>
                <Text style={styles.title}>Добавить актив</Text>
                <TouchableOpacity style={styles.closeButton} onPress={close} accessibilityLabel="Закрыть">
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </View>
            </View>
          </PanGestureHandler>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            <Text style={styles.cardLabel}>Тип актива</Text>
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

            {showNameField ? (
              <>
                <Text style={styles.cardLabel}>Название</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Например: Вклад в Сбере"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </>
            ) : null}

            {isMarketForm ? (
              <>
                <Text style={styles.formHint}>
                  {assetType === 'crypto'
                    ? 'Популярные монеты — кнопками ниже. Остальные — через поиск.'
                    : assetType === 'cash'
                      ? 'Курс валюты — с сайта ЦБ РФ.'
                      : 'Акции — котировки MOEX. Начните вводить тикер (ВК → VKCO).'}
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
                        onPress={() => {
                          setMarketUnit(unit.value);
                          setMarketSearchSelection(null);
                        }}
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
                    onSelect={setMarketSearchSelection}
                    onSearch={searchCoingeckoCoins}
                    disabled={isSaving}
                  />
                ) : null}
                {assetType === 'stocks' ? (
                  <MarketSearchPicker
                    placeholder="Поиск акции (ВК, Сбер, TATN…)"
                    selected={marketSearchSelection}
                    onSelect={setMarketSearchSelection}
                    onSearch={searchMoexStocks}
                    disabled={isSaving}
                  />
                ) : null}
                <TextInput
                  style={styles.input}
                  placeholder={
                    assetType === 'stocks' || assetType === 'crypto'
                      ? `Сколько · ${getUnitSymbol(resolvedMarketUnit) || '…'}`
                      : `Количество ${quickPickOptions.find((u) => u.value === marketUnit)?.symbol ?? ''}`
                  }
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  value={quantity}
                  onChangeText={setQuantity}
                />
              </>
            ) : (
              <>
                <Text style={styles.cardLabel}>Сумма в ₽</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Текущая стоимость"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
              </>
            )}

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.buttonDisabled]}
              onPress={() => void handleSubmit()}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.textOnAccent} />
              ) : (
                <Text style={styles.saveButtonText}>Добавить</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </AnimatedKeyboardAvoidingView>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
