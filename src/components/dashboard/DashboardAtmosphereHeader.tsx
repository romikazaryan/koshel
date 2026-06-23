import { StyleSheet, Text, View } from 'react-native';
import { MonthSwitcher } from '../MonthSwitcher';
import { formatMonthLabel, type MonthRef } from '../../lib/month';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  month: MonthRef;
  onMonthChange: (month: MonthRef) => void;
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  if (hour >= 18 && hour < 23) return 'Добрый вечер';
  return 'Доброй ночи';
}

export function DashboardAtmosphereHeader({ month, onMonthChange }: Props) {
  const { isDark } = useAppTheme();
  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      root: {
        marginHorizontal: -20,
        marginBottom: 6,
        paddingHorizontal: 20,
        paddingTop: 4,
        paddingBottom: 18,
        overflow: 'hidden',
      },
      orbIncome: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        top: -90,
        right: -70,
        backgroundColor: c.income,
        opacity: isDark ? 0.14 : 0.1,
      },
      orbExpense: {
        position: 'absolute',
        width: 180,
        height: 180,
        borderRadius: 90,
        top: -40,
        left: -60,
        backgroundColor: c.expense,
        opacity: isDark ? 0.1 : 0.07,
      },
      orbAccent: {
        position: 'absolute',
        width: 120,
        height: 120,
        borderRadius: 60,
        bottom: -20,
        right: 48,
        backgroundColor: c.accent,
        opacity: isDark ? 0.08 : 0.05,
      },
      topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 18,
      },
      brand: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 2.4,
        textTransform: 'lowercase',
        color: c.textMuted,
      },
      monthWrap: {
        width: 168,
        flexShrink: 0,
      },
      greeting: {
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: -0.6,
        color: c.text,
        marginBottom: 6,
      },
      subtitle: {
        fontSize: 14,
        fontWeight: '500',
        color: c.textMuted,
        letterSpacing: -0.1,
      },
    })
  );

  return (
    <View style={styles.root}>
      <View style={styles.orbIncome} pointerEvents="none" />
      <View style={styles.orbExpense} pointerEvents="none" />
      <View style={styles.orbAccent} pointerEvents="none" />

      <View style={styles.topRow}>
        <Text style={styles.brand}>koshel</Text>
        <View style={styles.monthWrap}>
          <MonthSwitcher value={month} onChange={onMonthChange} tone="ambient" />
        </View>
      </View>

      <Text style={styles.greeting}>{getGreeting()}</Text>
      <Text style={styles.subtitle}>Обзор за {formatMonthLabel(month).toLowerCase()}</Text>
    </View>
  );
}
