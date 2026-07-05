import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useCapitalCurrency } from '../../contexts/CapitalCurrencyContext';
import { NavyShimmerShell } from '../ui/NavyShimmerBackground';
import { moneyText } from '../../theme/layout';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { CapitalAllocationSegment } from '../../lib/capitalAssetDisplay';

type DayChange = {
  changeRub: number;
  changePercent: number;
};

type Props = {
  total: number;
  dayChange?: DayChange | null;
  dayChangeLoading?: boolean;
  allocation?: CapitalAllocationSegment[];
  ratesHint?: string | null;
};

const GOLD = '#D9A441';
const UP = '#34D399';
const DOWN = '#FB7185';

function formatPercent(value: number) {
  return value.toLocaleString('ru-RU', {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  });
}

export function CapitalHeroCard({
  total,
  dayChange,
  dayChangeLoading = false,
  allocation = [],
  ratesHint,
}: Props) {
  const { isDark, colors: c } = useAppTheme();
  const { format, formatSigned, symbol, cycle } = useCapitalCurrency();

  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      card: {
        borderRadius: radii.xl,
        paddingHorizontal: 18,
        paddingTop: 16,
        paddingBottom: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
        ...shadows.card,
      },
      content: {
        position: 'relative',
        zIndex: 2,
      },
      topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      },
      label: {
        fontSize: 10,
        fontWeight: '800',
        color: 'rgba(255,236,205,0.78)',
        textTransform: 'uppercase',
        letterSpacing: 1,
      },
      sparkle: { opacity: 0.85 },
      valueRow: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      },
      value: {
        flexShrink: 1,
        fontSize: 34,
        fontWeight: '900',
        color: c.textOnDark,
        letterSpacing: -1,
        ...moneyText,
      },
      currencyChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radii.pill,
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.16)',
      },
      currencyChipText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFECCD',
        ...moneyText,
      },
      changeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        gap: 8,
      },
      changePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: radii.pill,
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
      },
      changeText: {
        fontSize: 12,
        fontWeight: '800',
        ...moneyText,
      },
      changeCaption: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,236,205,0.6)',
      },
      allocWrap: {
        marginTop: 16,
      },
      allocBar: {
        flexDirection: 'row',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.08)',
      },
      allocSegment: {
        height: '100%',
      },
      legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 10,
        gap: 12,
      },
      legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      },
      legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
      },
      legendLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,236,205,0.72)',
      },
      legendShare: {
        fontSize: 11,
        fontWeight: '800',
        color: c.textOnDark,
        ...moneyText,
      },
      hint: {
        marginTop: 14,
        fontSize: 11,
        fontWeight: '500',
        color: 'rgba(255,236,205,0.55)',
        lineHeight: 15,
      },
    })
  );

  const changeUp = (dayChange?.changeRub ?? 0) > 0;
  const changeDown = (dayChange?.changeRub ?? 0) < 0;
  const changeColor = changeUp ? UP : changeDown ? DOWN : 'rgba(255,236,205,0.7)';
  const showAllocation = allocation.length >= 2;

  return (
    <NavyShimmerShell style={styles.card} idPrefix="capHero" showGoldEdge goldEdgeInset={18}>
      <View style={styles.content}>
      <View style={styles.topRow}>
        <Text style={styles.label}>Всего капитала</Text>
        <Ionicons name="sparkles" size={14} color={GOLD} style={styles.sparkle} />
      </View>

      <TouchableOpacity
        style={styles.valueRow}
        onPress={cycle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Сумма в ${symbol}. Нажмите, чтобы сменить валюту`}
      >
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {format(total)}
        </Text>
        <View style={styles.currencyChip}>
          <Ionicons name="swap-horizontal" size={11} color="rgba(255,236,205,0.85)" />
          <Text style={styles.currencyChipText}>{symbol}</Text>
        </View>
      </TouchableOpacity>

      {dayChange || dayChangeLoading ? (
        <View style={styles.changeRow}>
          <View style={styles.changePill}>
            {dayChangeLoading && !dayChange ? (
              <Text style={[styles.changeText, { color: 'rgba(255,236,205,0.7)' }]}>…</Text>
            ) : dayChange ? (
              <>
                <Ionicons
                  name={changeUp ? 'arrow-up' : changeDown ? 'arrow-down' : 'remove'}
                  size={11}
                  color={changeColor}
                />
                <Text style={[styles.changeText, { color: changeColor }]}>
                  {formatPercent(dayChange.changePercent)}%
                </Text>
              </>
            ) : null}
          </View>
          {dayChange ? (
            <Text style={[styles.changeText, { color: changeColor }]}>
              {formatSigned(dayChange.changeRub)}
            </Text>
          ) : null}
          <Text style={styles.changeCaption}>за сегодня</Text>
        </View>
      ) : null}

      {showAllocation ? (
        <View style={styles.allocWrap}>
          <View style={styles.allocBar}>
            {allocation.map((seg) => (
              <View
                key={seg.key}
                style={[
                  styles.allocSegment,
                  { flex: Math.max(seg.share, 0.001), backgroundColor: seg.color },
                ]}
              />
            ))}
          </View>
          <View style={styles.legend}>
            {allocation.slice(0, 4).map((seg) => (
              <View key={seg.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
                <Text style={styles.legendLabel}>{seg.label}</Text>
                <Text style={styles.legendShare}>{Math.round(seg.share * 100)}%</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {ratesHint ? (
        <Text style={styles.hint} numberOfLines={2}>
          {ratesHint}
        </Text>
      ) : null}
      </View>
    </NavyShimmerShell>
  );
}
