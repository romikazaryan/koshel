import { StyleSheet, Text, View } from 'react-native';
import { Card } from './ui/Card';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = {
  monthlyBudget: number;
  totalExpenses: number;
};

export function MonthlyBudgetCard({ monthlyBudget, totalExpenses }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, radii: r }) =>
    StyleSheet.create({
      title: {
        color: c.accentDark,
        fontSize: 12,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontWeight: '700',
      },
      row: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: 12,
        gap: 6,
      },
      spent: {
        fontSize: 28,
        fontWeight: '800',
        color: c.text,
      },
      limit: {
        fontSize: 15,
        color: c.textMuted,
        fontWeight: '600',
      },
      track: {
        height: 10,
        borderRadius: r.pill,
        backgroundColor: c.accentSoft,
        overflow: 'hidden',
        marginBottom: 8,
      },
      fill: {
        height: '100%',
        borderRadius: r.pill,
      },
      percent: {
        fontSize: 13,
        color: c.textMuted,
        marginBottom: 6,
      },
      hint: {
        fontSize: 15,
        fontWeight: '600',
        color: c.accentDark,
      },
      hintOver: {
        color: c.danger,
      },
    })
  );

  const spentPercent = Math.min(100, Math.round((totalExpenses / monthlyBudget) * 100));
  const remaining = monthlyBudget - totalExpenses;
  const isOver = remaining < 0;
  const barColor = isOver ? colors.danger : spentPercent >= 85 ? colors.warning : colors.accent;

  return (
    <Card variant="accent">
      <Text style={styles.title}>Лимит трат на месяц</Text>
      <View style={styles.row}>
        <Text style={styles.spent}>₽{totalExpenses.toLocaleString('ru-RU')}</Text>
        <Text style={styles.limit}>из ₽{monthlyBudget.toLocaleString('ru-RU')}</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${spentPercent}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.percent}>{spentPercent}% лимита</Text>

      <Text style={[styles.hint, isOver && styles.hintOver]}>
        {isOver
          ? `Превышение на ₽${Math.abs(remaining).toLocaleString('ru-RU')}`
          : `До лимита осталось ₽${remaining.toLocaleString('ru-RU')}`}
      </Text>
    </Card>
  );
}
