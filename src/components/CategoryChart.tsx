import { StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { Card } from './ui/Card';
import { Category } from '../types';
import { useThemedStyles } from '../theme/useThemedStyles';
import { AnimatedDonutChart } from './charts/AnimatedDonutChart';

type Props = {
  data: { category: Category; amount: number }[];
};

export function CategoryChart({ data }: Props) {
  const { chartPalette } = useAppTheme();
  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      title: {
        fontSize: 16,
        fontWeight: '700',
        color: c.text,
        marginBottom: 12,
      },
      empty: {
        color: c.textMuted,
        fontSize: 14,
        textAlign: 'center',
        paddingVertical: 24,
      },
    })
  );

  if (data.length === 0) {
    return (
      <Card variant="flat">
        <Text style={styles.title}>Траты по категориям</Text>
        <Text style={styles.empty}>Нет расходов за выбранный месяц</Text>
      </Card>
    );
  }

  const slices = data.map((item, index) => ({
    label: item.category,
    amount: item.amount,
    color: chartPalette[index % chartPalette.length],
  }));

  return (
    <Card>
      <Text style={styles.title}>Траты по категориям</Text>
      <AnimatedDonutChart slices={slices} centerLabel="Всего расходов" />
    </Card>
  );
}
