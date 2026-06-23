import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useCapitalCurrency } from '../../contexts/CapitalCurrencyContext';
import { type AssetsSectionMetrics } from '../../lib/capitalAssetDisplay';
import { hexToRgba } from '../../lib/colorUtils';
import { moneyText } from '../../theme/layout';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  metrics: AssetsSectionMetrics;
  historyLoading?: boolean;
};

export function CapitalSectionSummary({ metrics, historyLoading = false }: Props) {
  const { totalRub, activeCount, insight, dynamicsExpected } = metrics;
  const showDynamics = dynamicsExpected > 0;
  const { colors } = useAppTheme();
  const { format, formatSigned, cycle } = useCapitalCurrency();

  const up = !!insight && insight.changePercent > 0;
  const down = !!insight && insight.changePercent < 0;

  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      wrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.borderLight,
      },
      left: { flex: 1, minWidth: 0 },
      overline: {
        fontSize: 9,
        fontWeight: '800',
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 3,
      },
      value: {
        fontSize: 18,
        fontWeight: '900',
        color: c.text,
        letterSpacing: -0.4,
        ...moneyText,
      },
      pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radii.pill,
      },
      pillUp: { backgroundColor: hexToRgba(c.success, 0.14) },
      pillDown: { backgroundColor: hexToRgba(c.danger, 0.14) },
      pillFlat: { backgroundColor: c.surfaceMuted },
      pillText: { fontSize: 12, fontWeight: '800', ...moneyText },
      pillTextUp: { color: c.success },
      pillTextDown: { color: c.danger },
      pillTextFlat: { color: c.textMuted },
    })
  );

  const countLabel =
    activeCount === 1 ? '1 актив' : activeCount < 5 ? `${activeCount} актива` : `${activeCount} активов`;

  const pillStyle = up ? styles.pillUp : down ? styles.pillDown : styles.pillFlat;
  const pillTextStyle = up ? styles.pillTextUp : down ? styles.pillTextDown : styles.pillTextFlat;
  const iconColor = up ? colors.success : down ? colors.danger : colors.textMuted;

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.left}
        onPress={cycle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Нажмите, чтобы сменить валюту"
      >
        <Text style={styles.overline}>{countLabel}</Text>
        <Text style={styles.value} numberOfLines={1}>
          {format(totalRub)}
        </Text>
      </TouchableOpacity>

      {showDynamics ? (
        <View style={[styles.pill, pillStyle]}>
          {historyLoading && !insight ? (
            <Text style={[styles.pillText, styles.pillTextFlat]}>…</Text>
          ) : insight ? (
            <>
              <Ionicons
                name={up ? 'arrow-up' : down ? 'arrow-down' : 'remove'}
                size={11}
                color={iconColor}
              />
              <Text style={[styles.pillText, pillTextStyle]} numberOfLines={1}>
                {formatSigned(insight.changeRub)} ·{' '}
                {insight.changePercent.toLocaleString('ru-RU', {
                  maximumFractionDigits: 1,
                  signDisplay: 'exceptZero',
                })}
                %
              </Text>
            </>
          ) : (
            <Text style={[styles.pillText, styles.pillTextFlat]}>—</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}
