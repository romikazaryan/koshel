import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  formatCompactQuantitySubtitle,
  getMarketAssetDisplay,
} from '../../lib/capitalAssetDisplay';
import type { RateHistoryInsight } from '../../lib/capitalHistory';
import type { AssetValuation } from '../../lib/capitalValuation';
import type { CapitalAsset } from '../../types';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useCapitalCurrency } from '../../contexts/CapitalCurrencyContext';
import { hexToRgba } from '../../lib/colorUtils';
import { moneyText } from '../../theme/layout';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  item: CapitalAsset;
  valuation?: AssetValuation;
  history?: RateHistoryInsight;
  historyLoading?: boolean;
  isLast?: boolean;
  onPress: () => void;
};

export function CapitalMarketAssetRow({
  item,
  valuation,
  history,
  historyLoading = false,
  isLast = false,
  onPress,
}: Props) {
  const { title, symbol, sourceLabel } = getMarketAssetDisplay(item);
  const displayRub = valuation?.valueRub ?? item.amount;
  const subtitle = formatCompactQuantitySubtitle(item, valuation);
  const { colors } = useAppTheme();
  const { format, formatSigned, cycle } = useCapitalCurrency();

  const up = !!history && history.changePercent > 0;
  const down = !!history && history.changePercent < 0;

  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        gap: 11,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: c.borderLight,
        opacity: item.isActive ? 1 : 0.42,
      },
      avatar: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: hexToRgba(c.accent, 0.12),
        borderWidth: 1,
        borderColor: hexToRgba(c.accent, 0.2),
        alignItems: 'center',
        justifyContent: 'center',
      },
      avatarText: {
        color: c.accentDark,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
      },
      main: { flex: 1, minWidth: 0 },
      title: {
        fontSize: 15,
        fontWeight: '700',
        color: c.text,
        letterSpacing: -0.2,
      },
      subtitle: {
        marginTop: 2,
        fontSize: 12,
        fontWeight: '500',
        color: c.textMuted,
      },
      right: { alignItems: 'flex-end', maxWidth: '50%' },
      value: {
        fontSize: 15,
        fontWeight: '800',
        color: c.text,
        ...moneyText,
      },
      pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: radii.pill,
      },
      pillUp: { backgroundColor: hexToRgba(c.success, 0.14) },
      pillDown: { backgroundColor: hexToRgba(c.danger, 0.14) },
      pillFlat: { backgroundColor: c.surfaceMuted },
      pillText: { fontSize: 11, fontWeight: '800', ...moneyText },
      pillTextUp: { color: c.success },
      pillTextDown: { color: c.danger },
      pillTextFlat: { color: c.textMuted },
      error: { fontSize: 11, color: c.danger, marginTop: 2 },
    })
  );

  const avatarLabel = symbol.length > 4 ? symbol.slice(0, 3) : symbol;
  const metaLine = [sourceLabel, subtitle].filter(Boolean).join(' · ');
  const pillStyle = up ? styles.pillUp : down ? styles.pillDown : styles.pillFlat;
  const pillTextStyle = up ? styles.pillTextUp : down ? styles.pillTextDown : styles.pillTextFlat;
  const iconColor = up ? colors.success : down ? colors.danger : colors.textMuted;

  const changeLabel = history
    ? `${formatSigned(history.changeRub)} · ${history.changePercent.toLocaleString('ru-RU', {
        maximumFractionDigits: 1,
        signDisplay: 'exceptZero',
      })}%`
    : '';

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.65}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText} numberOfLines={1}>
          {avatarLabel}
        </Text>
      </View>

      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {metaLine ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {metaLine}
          </Text>
        ) : null}
        {valuation?.error ? (
          <Text style={styles.error} numberOfLines={1}>
            {valuation.error}
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>
        <TouchableOpacity
          onPress={cycle}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Нажмите, чтобы сменить валюту"
        >
          <Text style={styles.value} numberOfLines={1}>
            {format(displayRub)}
          </Text>
        </TouchableOpacity>
        {historyLoading && !history ? (
          <View style={[styles.pill, styles.pillFlat]}>
            <Text style={[styles.pillText, styles.pillTextFlat]}>…</Text>
          </View>
        ) : history ? (
          <View style={[styles.pill, pillStyle]}>
            <Ionicons
              name={up ? 'arrow-up' : down ? 'arrow-down' : 'remove'}
              size={10}
              color={iconColor}
            />
            <Text style={[styles.pillText, pillTextStyle]} numberOfLines={1}>
              {changeLabel}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}
