import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { darkColors } from '../../theme/colors';
import { NavyShimmerShell } from '../ui/NavyShimmerBackground';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { formatMoney } from '../../lib/formatMoney';

type Props = {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  recurringExpenseHint?: string | null;
  onOpenIncome: () => void;
  onOpenExpenses: () => void;
};

export function DashboardOverviewHero({
  balance,
  totalIncome,
  totalExpenses,
  recurringExpenseHint,
  onOpenIncome,
  onOpenExpenses,
}: Props) {
  const { isDark } = useAppTheme();

  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      card: {
        borderRadius: radii.xl,
        paddingHorizontal: 18,
        paddingTop: 20,
        paddingBottom: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
        ...shadows.card,
      },
      content: {
        position: 'relative',
        zIndex: 2,
      },
      balanceBlock: {
        marginBottom: 16,
      },
      balanceLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: c.textOnDarkMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.55,
        marginBottom: 6,
      },
      balanceValue: {
        fontSize: 32,
        fontWeight: '800',
        color: c.textOnDark,
        letterSpacing: -0.8,
        fontVariant: ['tabular-nums'],
      },
      metricsRow: {
        flexDirection: 'row',
        gap: 8,
      },
      metricCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.09)',
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        paddingVertical: 11,
        paddingHorizontal: 11,
      },
      metricTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 5,
      },
      metricLabel: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      },
      metricLabelIncome: { color: darkColors.income },
      metricLabelExpense: { color: darkColors.expense },
      metricChevron: {
        fontSize: 16,
        lineHeight: 18,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.55)',
      },
      metricValue: {
        fontSize: 15,
        fontWeight: '800',
        color: c.textOnDark,
        marginBottom: 2,
        fontVariant: ['tabular-nums'],
      },
      metricAction: {
        fontSize: 10,
        fontWeight: '600',
        color: c.textOnDarkMuted,
      },
      metricHint: {
        marginTop: 2,
        fontSize: 9,
        lineHeight: 12,
        color: c.textOnDarkMuted,
      },
    })
  );

  return (
    <NavyShimmerShell style={styles.card} idPrefix="dashHero" showGoldEdge goldEdgeInset={18}>
      <View style={styles.content}>
        <View style={styles.balanceBlock}>
          <Text style={styles.balanceLabel}>Баланс</Text>
          <Text style={styles.balanceValue}>{formatMoney(balance)}</Text>
        </View>

        <View style={styles.metricsRow}>
          <TouchableOpacity
            style={styles.metricCard}
            onPress={onOpenIncome}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Открыть доходы"
          >
            <View style={styles.metricTopRow}>
              <Text style={[styles.metricLabel, styles.metricLabelIncome]}>Доход</Text>
              <Text style={styles.metricChevron}>›</Text>
            </View>
            <Text style={styles.metricValue}>{formatMoney(totalIncome)}</Text>
            <Text style={styles.metricAction}>Подробнее</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={onOpenExpenses}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Открыть расходы"
          >
            <View style={styles.metricTopRow}>
              <Text style={[styles.metricLabel, styles.metricLabelExpense]}>Расходы</Text>
              <Text style={styles.metricChevron}>›</Text>
            </View>
            <Text style={styles.metricValue}>{formatMoney(totalExpenses)}</Text>
            <Text style={styles.metricAction}>Подробнее</Text>
            {recurringExpenseHint ? (
              <Text style={styles.metricHint}>{recurringExpenseHint}</Text>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>
    </NavyShimmerShell>
  );
}
