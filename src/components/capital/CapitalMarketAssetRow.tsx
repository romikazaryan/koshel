import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  formatCompactHistoryChange,
  formatCompactQuantitySubtitle,
  formatCompactValueRub,
  getMarketAssetDisplay,
} from '../../lib/capitalAssetDisplay';
import type { RateHistoryInsight } from '../../lib/capitalHistory';
import type { AssetValuation } from '../../lib/capitalValuation';
import type { CapitalAsset } from '../../types';
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

  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 11,
        paddingHorizontal: 14,
        gap: 12,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: c.borderLight,
        opacity: item.isActive ? 1 : 0.45,
      },
      avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: c.accent,
        alignItems: 'center',
        justifyContent: 'center',
      },
      avatarText: {
        color: c.textOnDark,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.2,
      },
      main: {
        flex: 1,
        minWidth: 0,
      },
      title: {
        fontSize: 16,
        fontWeight: '600',
        color: c.text,
        marginBottom: 2,
      },
      sourceLabel: {
        fontSize: 11,
        fontWeight: '500',
        color: c.textMuted,
        marginBottom: 2,
        letterSpacing: 0.2,
      },
      subtitle: {
        fontSize: 13,
        color: c.textMuted,
      },
      right: {
        alignItems: 'flex-end',
        maxWidth: '42%',
      },
      value: {
        fontSize: 16,
        fontWeight: '700',
        color: c.text,
        marginBottom: 2,
      },
      changeUp: { fontSize: 13, fontWeight: '600', color: c.success },
      changeDown: { fontSize: 13, fontWeight: '600', color: c.danger },
      changeFlat: { fontSize: 13, fontWeight: '600', color: c.textMuted },
      changeLoading: { fontSize: 13, fontWeight: '600', color: c.textMuted },
      error: { fontSize: 12, color: c.danger, marginTop: 2 },
    })
  );

  const changeStyle =
    history && history.changePercent > 0
      ? styles.changeUp
      : history && history.changePercent < 0
        ? styles.changeDown
        : styles.changeFlat;

  const avatarLabel = symbol.length > 4 ? symbol.slice(0, 3) : symbol;

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
        {sourceLabel ? (
          <Text style={styles.sourceLabel} numberOfLines={1}>
            {sourceLabel}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {valuation?.error ? (
          <Text style={styles.error} numberOfLines={1}>
            {valuation.error}
          </Text>
        ) : null}
      </View>

      <View style={styles.right}>
        <Text style={styles.value} numberOfLines={1}>
          {formatCompactValueRub(displayRub)} ₽
        </Text>
        {historyLoading ? (
          <Text style={styles.changeLoading} numberOfLines={1}>
            …
          </Text>
        ) : history ? (
          <Text style={changeStyle} numberOfLines={1}>
            {formatCompactHistoryChange(history)}
          </Text>
        ) : (
          <Text style={styles.changeLoading} numberOfLines={1}>
            —
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
