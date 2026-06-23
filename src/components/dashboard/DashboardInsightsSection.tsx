import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CategoryChart } from '../CategoryChart';
import { HealthScoreCard } from '../HealthScoreCard';
import { MonthlyBudgetCard } from '../MonthlyBudgetCard';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Card } from '../ui/Card';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AnalysisPeriodMonths } from '../../types/monthAnalysis';
import type { Category } from '../../types';

type Props = {
  monthlyBudget: number | null;
  totalExpenses: number;
  healthScore: number;
  categorySummary: { category: Category; amount: number }[];
  showChart: boolean;
  monthLabel: string;
  chartSubtitle?: string;
  analysisPeriod: AnalysisPeriodMonths;
  onPeriodChange: (period: AnalysisPeriodMonths) => void;
  onAnalyze: () => void;
  analyzing: boolean;
};

const PERIOD_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: 'Мес' },
  { value: '6', label: '6 мес' },
  { value: '12', label: 'Год' },
];

export function DashboardInsightsSection({
  monthlyBudget,
  totalExpenses,
  healthScore,
  categorySummary,
  showChart,
  monthLabel,
  chartSubtitle = 'за месяц',
  analysisPeriod,
  onPeriodChange,
  onAnalyze,
  analyzing,
}: Props) {
  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      sectionLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 8,
      },
      block: {
        marginBottom: 12,
        padding: 0,
        overflow: 'hidden',
      },
      sectionHeader: {
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: c.surfaceMuted,
        borderBottomWidth: 1,
        borderBottomColor: c.borderLight,
      },
      sectionHeaderText: {
        fontSize: 12,
        fontWeight: '800',
        color: c.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      },
      sectionBody: {
        paddingHorizontal: 14,
        paddingVertical: 12,
      },
      divider: {
        height: 1,
        backgroundColor: c.borderLight,
        marginHorizontal: 14,
      },
      analyzeWrap: {
        backgroundColor: c.primarySoft,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: c.borderLight,
      },
      analyzeTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: c.text,
        marginBottom: 2,
      },
      analyzeHint: {
        fontSize: 12,
        color: c.textMuted,
        marginBottom: 10,
        lineHeight: 16,
      },
      periodControl: {
        marginBottom: 10,
      },
      button: {
        backgroundColor: c.navy,
        borderRadius: radii.md,
        paddingVertical: 12,
        alignItems: 'center',
      },
      buttonDisabled: {
        opacity: 0.6,
      },
      buttonText: {
        fontSize: 14,
        fontWeight: '800',
        color: c.textOnDark,
      },
    })
  );

  return (
    <>
      <Text style={styles.sectionLabel}>Аналитика</Text>
      <Card style={styles.block} variant="flat">
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Обзор месяца</Text>
        </View>

        <View style={styles.sectionBody}>
          {monthlyBudget != null ? (
            <>
              <MonthlyBudgetCard
                embedded
                compact
                monthlyBudget={monthlyBudget}
                totalExpenses={totalExpenses}
              />
              <View style={[styles.divider, { marginTop: 12, marginBottom: 12 }]} />
            </>
          ) : null}

          <HealthScoreCard embedded compact score={healthScore} />

          {showChart ? (
            <>
              <View style={[styles.divider, { marginTop: 12, marginBottom: 12 }]} />
              <CategoryChart
                embedded
                compact
                data={categorySummary}
                monthLabel={monthLabel}
                centerSubtitle={chartSubtitle}
              />
            </>
          ) : null}
        </View>

        <View style={styles.analyzeWrap}>
          <Text style={styles.analyzeTitle}>Финансовый разбор</Text>
          <Text style={styles.analyzeHint}>AI подскажет, на что обратить внимание</Text>
          <SegmentedControl
            style={styles.periodControl}
            options={PERIOD_OPTIONS}
            value={String(analysisPeriod)}
            onChange={(value) => onPeriodChange(Number(value) as AnalysisPeriodMonths)}
          />
          <TouchableOpacity
            style={[styles.button, analyzing && styles.buttonDisabled]}
            onPress={onAnalyze}
            disabled={analyzing}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>{analyzing ? 'Анализируем…' : 'Анализировать'}</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </>
  );
}
