import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { Card } from './ui/Card';
import { Category } from '../types';
import { useThemedStyles } from '../theme/useThemedStyles';
import { AnimatedDonutChart } from './charts/AnimatedDonutChart';
import { SpendingBreakdownSheet } from './expense/SpendingBreakdownSheet';

type Props = {
  data: { category: Category; amount: number }[];
  embedded?: boolean;
  compact?: boolean;
  monthLabel?: string;
  centerSubtitle?: string;
};

export function CategoryChart({
  data,
  embedded = false,
  compact = false,
  monthLabel = 'Этот месяц',
  centerSubtitle = 'за месяц',
}: Props) {
  const { chartPalette } = useAppTheme();
  const [sheetOpen, setSheetOpen] = useState(false);

  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      },
      title: {
        fontSize: 13,
        fontWeight: '800',
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1.4,
      },
      hint: {
        marginTop: 12,
        fontSize: 12,
        textAlign: 'center',
        color: c.textMuted,
        letterSpacing: 0.1,
      },
      empty: {
        color: c.textMuted,
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: compact ? 16 : 28,
      },
    })
  );

  const slices = useMemo(
    () =>
      [...data]
        .sort((a, b) => b.amount - a.amount)
        .map((item, index) => ({
          label: item.category,
          amount: item.amount,
          color: chartPalette[index % chartPalette.length],
        })),
    [chartPalette, data]
  );

  const breakdownItems = useMemo(
    () =>
      slices.map((s) => ({
        category: s.label as Category,
        amount: s.amount,
        color: s.color,
      })),
    [slices]
  );

  if (data.length === 0) {
    const empty = <Text style={styles.empty}>Нет расходов за месяц</Text>;
    if (embedded) return <View>{empty}</View>;
    return <Card variant="flat">{empty}</Card>;
  }

  const content = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Аналитика расходов</Text>
      </View>

      <AnimatedDonutChart
        slices={slices}
        size={compact ? 220 : 240}
        centerTitle="Всего расходов"
        centerSubtitle={centerSubtitle}
        onPress={() => setSheetOpen(true)}
      />

      <Text style={styles.hint}>Нажмите на график — разбор по категориям</Text>

      <SpendingBreakdownSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        monthLabel={monthLabel}
        items={breakdownItems}
      />
    </>
  );

  if (embedded) return <View>{content}</View>;
  return <Card>{content}</Card>;
}
