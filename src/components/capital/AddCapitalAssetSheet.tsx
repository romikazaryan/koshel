import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandler } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop } from '../ui/BottomSheetBackdrop';
import { Button } from '../ui/Button';
import { Chip } from '../ui/Chip';
import { Input } from '../ui/Input';
import { NavyHeroBlock } from '../ui/NavyHeroBlock';
import { SectionLabel } from '../ui/SectionLabel';
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
import { heroOnDark } from '../../theme/premium';
import { spacing, typography } from '../../theme/layout';
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
      overlay: { flex: 1, justifyContent: 'flex-end' },
      sheet: {
        width: '100%',
        maxHeight: '90%',
        minHeight: 520,
        backgroundColor: c.surface,
        borderTopLeftRadius: radii.xl + 4,
        borderTopRightRadius: radii.xl + 4,
        paddingBottom: Math.max(insets.bottom, spacing.lg),
        overflow: 'hidden',
        ...shadows.card,
      },
      handleWrap: {
        alignItems: 'center',
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
      },
      handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: heroOnDark.handle,
      },
      heroInner: {
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xl,
      },
      heroTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
      },
      heroTitle: {
        ...typography.h1,
        color: heroOnDark.title,
        letterSpacing: -0.6,
        flex: 1,
        paddingRight: spacing.md,
      },
      closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: heroOnDark.closeBg,
        alignItems: 'center',
        justifyContent: 'center',
      },
      heroSubtitle: {
        ...typography.body,
        color: heroOnDark.subtitle,
        marginTop: 6,
        lineHeight: 21,
      },
      content: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xxl,
        flexGrow: 1,
      },
      chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.md,
      },
      formHint: {
        ...typography.meta,
        color: c.textMuted,
        lineHeight: 19,
        marginBottom: spacing.md,
      },
      formCard: {
        backgroundColor: c.surfaceMuted,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: c.borderLight,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        gap: spacing.md,
      },
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
                <NavyHeroBlock>
                  <View style={styles.handleWrap}>
                    <View style={styles.handle} />
                  </View>
                  <View style={styles.heroInner}>
                    <View style={styles.heroTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.heroTitle}>Добавить актив</Text>
                        <Text style={styles.heroSubtitle}>
                          Акции, крипта, валюта или ручная оценка
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={close}
                        accessibilityLabel="Закрыть"
                      >
                        <Ionicons name="close" size={20} color={heroOnDark.title} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </NavyHeroBlock>
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
              <SectionLabel>Тип актива</SectionLabel>
              <View style={styles.chipRow}>
                {CAPITAL_ASSET_TYPES.map((type) => (
                  <Chip
                    key={type.value}
                    label={type.label}
                    active={assetType === type.value}
                    variant="default"
                    onPress={() => handleTypeChange(type.value)}
                  />
                ))}
              </View>

              <View style={styles.formCard}>
                {showNameField ? (
                  <Input
                    label="Название"
                    placeholder="Например: Вклад в Сбере"
                    value={name}
                    onChangeText={setName}
                  />
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
                    <View style={styles.chipRow}>
                      {quickPickOptions.map((unit) => {
                        const isActive =
                          marketUnit === unit.value &&
                          (assetType === 'cash' || !marketSearchSelection);
                        return (
                          <Chip
                            key={unit.value}
                            label={unit.symbol}
                            active={isActive}
                            variant="accent"
                            onPress={() => {
                              setMarketUnit(unit.value);
                              setMarketSearchSelection(null);
                            }}
                          />
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
                    <Input
                      label="Количество"
                      placeholder={
                        assetType === 'stocks' || assetType === 'crypto'
                          ? `Сколько · ${getUnitSymbol(resolvedMarketUnit) || '…'}`
                          : `Количество ${quickPickOptions.find((u) => u.value === marketUnit)?.symbol ?? ''}`
                      }
                      keyboardType="decimal-pad"
                      value={quantity}
                      onChangeText={setQuantity}
                    />
                  </>
                ) : (
                  <Input
                    label="Сумма в ₽"
                    placeholder="Текущая стоимость"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                  />
                )}
              </View>

              <Button
                label="Добавить в портфель"
                onPress={() => void handleSubmit()}
                loading={isSaving}
                disabled={isSaving}
              />
            </ScrollView>
          </AnimatedKeyboardAvoidingView>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
