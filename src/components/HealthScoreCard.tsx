import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { Card } from './ui/Card';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = {
  score: number;
};

export function HealthScoreCard({ score }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      title: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 8,
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      },
      score: {
        fontSize: 40,
        fontWeight: '800',
      },
      track: {
        height: 10,
        width: '100%',
        backgroundColor: c.primarySoft,
        borderRadius: radii.pill,
        marginTop: 12,
        overflow: 'hidden',
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
    })
  );

  const barColor =
    score < 40 ? colors.danger : score < 70 ? colors.warning : colors.accent;

  return (
    <Card>
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
    </Card>
  );
}
