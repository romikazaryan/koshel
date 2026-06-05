import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MonthRef } from '../lib/month';
import { formatMonthLabel, getTodayMonth, isMonthAfter, shiftMonth } from '../lib/month';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = {
  value: MonthRef;
  onChange: (next: MonthRef) => void;
};

export function MonthSwitcher({ value, onChange }: Props) {
  const styles = useThemedStyles(({ colors, radii, shadows }) =>
    StyleSheet.create({
      wrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.borderLight,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 16,
        ...shadows.soft,
      },
      arrow: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accentSoft,
      },
      arrowDisabled: {
        backgroundColor: colors.primarySoft,
      },
      arrowText: {
        fontSize: 28,
        lineHeight: 30,
        fontWeight: '600',
        color: colors.accentDark,
        marginTop: -2,
      },
      arrowTextDisabled: {
        color: colors.textMuted,
      },
      label: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
      },
    })
  );

  const today = getTodayMonth();
  const canGoForward = !isMonthAfter(shiftMonth(value, 1), today);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.arrow}
        onPress={() => onChange(shiftMonth(value, -1))}
        accessibilityLabel="Предыдущий месяц"
      >
        <Text style={styles.arrowText}>‹</Text>
      </TouchableOpacity>

      <Text style={styles.label}>{formatMonthLabel(value)}</Text>

      <TouchableOpacity
        style={[styles.arrow, !canGoForward && styles.arrowDisabled]}
        onPress={() => canGoForward && onChange(shiftMonth(value, 1))}
        disabled={!canGoForward}
        accessibilityLabel="Следующий месяц"
      >
        <Text style={[styles.arrowText, !canGoForward && styles.arrowTextDisabled]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}
