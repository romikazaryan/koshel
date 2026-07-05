import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Button } from '../ui/Button';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { LUXURY_GOLD } from '../../theme/premium';
import { spacing, typography } from '../../theme/layout';
import type { AnalysisPeriodMonths } from '../../types/monthAnalysis';

type Props = {
  analysisPeriod: AnalysisPeriodMonths;
  onPeriodChange: (period: AnalysisPeriodMonths) => void;
  onAnalyze: () => void;
  analyzing: boolean;
};

const PERIOD_OPTIONS = [
  { value: '1', label: 'Мес' },
  { value: '6', label: '6 мес' },
  { value: '12', label: 'Год' },
];

export function AnalyzeMonthInvite({
  analysisPeriod,
  onPeriodChange,
  onAnalyze,
  analyzing,
}: Props) {
  const styles = useThemedStyles(({ colors: c, radii, shadows, cardBase }) =>
    StyleSheet.create({
      card: {
        ...cardBase,
        borderRadius: radii.xl,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: c.borderLight,
        overflow: 'hidden',
        ...shadows.soft,
      },
      inner: {
        flexDirection: 'row',
        padding: spacing.md,
        gap: spacing.md,
        alignItems: 'flex-start',
      },
      goldRail: {
        width: 3,
        alignSelf: 'stretch',
        borderRadius: 2,
        backgroundColor: LUXURY_GOLD,
        opacity: 0.85,
      },
      iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceMuted,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      body: { flex: 1 },
      eyebrow: {
        ...typography.overline,
        color: c.textMuted,
        letterSpacing: 0.8,
        marginBottom: 4,
      },
      title: {
        ...typography.h3,
        fontSize: 17,
        color: c.text,
        marginBottom: 4,
      },
      hint: {
        ...typography.body,
        fontSize: 13,
        lineHeight: 19,
        color: c.textMuted,
        marginBottom: spacing.md,
      },
      footer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.borderLight,
        padding: spacing.md,
        paddingTop: spacing.sm,
        backgroundColor: c.surfaceMuted,
      },
      periodControl: {
        marginBottom: spacing.sm,
      },
    })
  );

  return (
    <View style={styles.card}>
      <View style={styles.inner}>
        <View style={styles.goldRail} />
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={22} color={LUXURY_GOLD} />
        </View>
        <View style={styles.body}>
          <Text style={styles.eyebrow}>AI · персонально</Text>
          <Text style={styles.title}>Разбор месяца</Text>
          <Text style={styles.hint}>
            Короткие советы по тратам, лимиту и приоритетам — без воды.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <SegmentedControl
          style={styles.periodControl}
          options={PERIOD_OPTIONS}
          value={String(analysisPeriod)}
          onChange={(value) => onPeriodChange(Number(value) as AnalysisPeriodMonths)}
        />
        <Button
          label={analyzing ? 'Готовим разбор…' : 'Получить разбор'}
          onPress={onAnalyze}
          loading={analyzing}
          disabled={analyzing}
        />
      </View>
    </View>
  );
}
