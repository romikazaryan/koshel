import { StyleSheet, Text, View } from 'react-native';
import {
  formatCompactHistoryChange,
  formatCompactValueRub,
  type AssetsSectionMetrics,
} from '../../lib/capitalAssetDisplay';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  metrics: AssetsSectionMetrics;
  historyLoading?: boolean;
};

export function CapitalSectionSummary({ metrics, historyLoading = false }: Props) {
  const { totalRub, activeCount, insight, dynamicsExpected } = metrics;
  const showDynamics = dynamicsExpected > 0;

  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      wrap: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: c.borderLight,
      },
      main: { flex: 1, minWidth: 0 },
      meta: { alignItems: 'flex-end', justifyContent: 'center', maxWidth: '42%' },
      count: {
        fontSize: 13,
        fontWeight: '600',
        color: c.textMuted,
        textAlign: 'right',
      },
      value: {
        fontSize: 18,
        fontWeight: '800',
        color: c.text,
        marginBottom: 2,
      },
      changeUp: { fontSize: 13, fontWeight: '600', color: c.success },
      changeDown: { fontSize: 13, fontWeight: '600', color: c.danger },
      changeFlat: { fontSize: 13, fontWeight: '600', color: c.textMuted },
      changeLoading: { fontSize: 13, fontWeight: '600', color: c.textMuted },
    })
  );

  const changeStyle =
    insight && insight.changePercent > 0
      ? styles.changeUp
      : insight && insight.changePercent < 0
        ? styles.changeDown
        : styles.changeFlat;

  const countLabel =
    activeCount === 1 ? '1 актив' : activeCount < 5 ? `${activeCount} актива` : `${activeCount} активов`;

  return (
    <View style={styles.wrap}>
      <View style={styles.main}>
        <Text style={styles.value} numberOfLines={1}>
          {formatCompactValueRub(totalRub)} ₽
        </Text>
        {showDynamics ? (
          historyLoading ? (
            <Text style={styles.changeLoading} numberOfLines={1}>
              …
            </Text>
          ) : insight ? (
            <Text style={changeStyle} numberOfLines={1}>
              {formatCompactHistoryChange(insight)}
            </Text>
          ) : (
            <Text style={styles.changeLoading} numberOfLines={1}>
              —
            </Text>
          )
        ) : null}
      </View>
      <View style={styles.meta}>
        <Text style={styles.count}>{countLabel}</Text>
      </View>
    </View>
  );
}
