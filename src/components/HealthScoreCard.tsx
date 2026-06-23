import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { Card } from './ui/Card';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = {
  score: number;
  embedded?: boolean;
  compact?: boolean;
};

export function HealthScoreCard({ score, embedded = false, compact = false }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      title: {
        fontSize: compact ? 11 : 13,
        fontWeight: '700',
        marginBottom: compact ? 6 : 8,
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      },
      compactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      },
      compactMain: {
        minWidth: 52,
      },
      score: {
        fontSize: compact ? 28 : 40,
        fontWeight: '800',
      },
      track: {
        height: compact ? 8 : 10,
        width: '100%',
        backgroundColor: c.primarySoft,
        borderRadius: radii.pill,
        marginTop: compact ? 0 : 12,
        overflow: 'hidden',
        flex: compact ? 1 : undefined,
      },
      fill: {
        height: '100%',
        borderRadius: radii.pill,
      },
      hint: {
        marginTop: 10,
        color: c.textSecondary,
        fontSize: 14,
        lineHeight: 20,
      },
      compactHint: {
        marginTop: 6,
        color: c.textMuted,
        fontSize: 12,
        lineHeight: 16,
      },
    })
  );

  const barColor =
    score < 40 ? colors.expense : score < 70 ? colors.warning : colors.income;

  const hint =
    score < 40
      ? 'Стоит сократить траты.'
      : score < 70
        ? 'Есть что улучшить.'
        : 'Отличный результат!';

  const content = compact ? (
    <>
      <Text style={styles.title}>Здоровье</Text>
      <View style={styles.compactRow}>
        <View style={styles.compactMain}>
          <Text style={[styles.score, { color: barColor }]}>{score}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${score}%`, backgroundColor: barColor }]} />
        </View>
      </View>
      <Text style={styles.compactHint}>{hint}</Text>
    </>
  ) : (
    <>
      <Text style={styles.title}>Индекс финансового здоровья</Text>
      <Text style={[styles.score, { color: barColor }]}>{score}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${score}%`, backgroundColor: barColor }]} />
      </View>
      <Text style={styles.hint}>
        {score < 40
          ? 'Стоит сократить траты и накопить подушку.'
          : score < 70
            ? 'Хорошо, но есть что улучшить.'
            : 'Отличный результат, вы в порядке!'}
      </Text>
    </>
  );

  if (embedded) return <View>{content}</View>;
  return <Card>{content}</Card>;
}
