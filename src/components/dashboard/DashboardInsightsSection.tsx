import { StyleSheet, Text, View } from 'react-native';
import { CategoryChart } from '../CategoryChart';
import { HealthScoreCard } from '../HealthScoreCard';
import { MonthlyBudgetCard } from '../MonthlyBudgetCard';
import { AnalyzeMonthInvite } from './AnalyzeMonthInvite';
import { Card } from '../ui/Card';
import { SectionLabel } from '../ui/SectionLabel';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { spacing } from '../../theme/layout';
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
      block: {
        marginBottom: spacing.sm,
        padding: 0,
        overflow: 'hidden',
        borderRadius: radii.xl,
      },
      sectionHeader: {
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        paddingBottom: spacing.sm,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.borderLight,
        backgroundColor: c.surfaceMuted,
      },
      sectionHeaderText: {
        fontSize: 12,
        fontWeight: '800',
        color: c.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
      },
      sectionBody: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
      },
      divider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: c.borderLight,
        marginVertical: spacing.sm,
      },
    })
  );

  return (
    <>
      <SectionLabel>Аналитика</SectionLabel>
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
              <View style={styles.divider} />
            </>
          ) : null}

          <HealthScoreCard embedded compact score={healthScore} />

          {showChart ? (
            <>
              <View style={styles.divider} />
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
      </Card>

      <AnalyzeMonthInvite
        analysisPeriod={analysisPeriod}
        onPeriodChange={onPeriodChange}
        onAnalyze={onAnalyze}
        analyzing={analyzing}
      />
    </>
  );
}
