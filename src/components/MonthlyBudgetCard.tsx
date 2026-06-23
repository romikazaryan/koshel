import { StyleSheet, Text, View } from 'react-native';
import { Card } from './ui/Card';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = {
  monthlyBudget: number;
  totalExpenses: number;
  embedded?: boolean;
  compact?: boolean;
};

export function MonthlyBudgetCard({
  monthlyBudget,
  totalExpenses,
  embedded = false,
  compact = false,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, radii: r }) =>
    StyleSheet.create({
      title: {
        color: c.textMuted,
        fontSize: compact ? 11 : 12,
        marginBottom: compact ? 6 : 10,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        fontWeight: '700',
      },
      row: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginBottom: compact ? 8 : 12,
        gap: 6,
      },
      spent: {
        fontSize: compact ? 22 : 28,
        fontWeight: '800',
        color: c.text,
      },
      limit: {
        fontSize: compact ? 13 : 15,
        color: c.textMuted,
        fontWeight: '600',
      },
      track: {
        height: compact ? 8 : 10,
        borderRadius: r.pill,
        backgroundColor: c.backgroundDeep,
        overflow: 'hidden',
        marginBottom: compact ? 4 : 8,
      },
      fill: {
        height: '100%',
        borderRadius: r.pill,
      },
      metaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
      },
      percent: {
        fontSize: compact ? 12 : 13,
        color: c.textMuted,
      },
      hint: {
        fontSize: compact ? 12 : 15,
        fontWeight: '600',
        color: c.textSecondary,
      },
      hintOver: {
        color: c.danger,
      },
    })
  );

  const spentPercent = Math.min(100, Math.round((totalExpenses / monthlyBudget) * 100));
  const remaining = monthlyBudget - totalExpenses;
  const isOver = remaining < 0;
  const barColor = isOver ? colors.danger : spentPercent >= 85 ? colors.warning : colors.expense;

  const hintText = isOver
    ? `+₽${Math.abs(remaining).toLocaleString('ru-RU')}`
    : `−₽${remaining.toLocaleString('ru-RU')}`;

  const content = (
    <>
      <Text style={styles.title}>Лимит на месяц</Text>
      <View style={styles.row}>
        <Text style={styles.spent}>₽{totalExpenses.toLocaleString('ru-RU')}</Text>
        <Text style={styles.limit}>/ ₽{monthlyBudget.toLocaleString('ru-RU')}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${spentPercent}%`, backgroundColor: barColor }]} />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.percent}>{spentPercent}%</Text>
        <Text style={[styles.hint, isOver && styles.hintOver]}>{hintText}</Text>
      </View>
    </>
  );

  if (embedded) return <View>{content}</View>;
  return <Card>{content}</Card>;
}
