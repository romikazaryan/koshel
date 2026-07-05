import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FadeSlideIn } from '../components/animations/FadeSlideIn';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SectionLabel } from '../components/ui/SectionLabel';
import { NavyHeroBlock } from '../components/ui/NavyHeroBlock';
import type { HomeStackParamList } from '../navigation/types';
import type { MonthAnalysisOptimization, MonthAnalysisResult } from '../types/monthAnalysis';
import { heroOnDark, LUXURY_GOLD } from '../theme/premium';
import { spacing, typography } from '../theme/layout';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = NativeStackScreenProps<HomeStackParamList, 'Recommendations'>;
type RecommendationsStyles = ReturnType<typeof createStyles>;

const OPTIMIZATION_LABELS: Record<MonthAnalysisOptimization['kind'], string> = {
  tax: 'Налог',
  bank: 'Банк',
  broker: 'Инвестиции',
};

function PriorityCard({
  index,
  item,
  styles,
}: {
  index: number;
  item: MonthAnalysisResult['priorities'][number];
  styles: RecommendationsStyles;
}) {
  return (
    <View style={styles.priorityCard}>
      <View style={styles.priorityIndex}>
        <Text style={styles.priorityIndexText}>{index + 1}</Text>
      </View>
      <View style={styles.priorityBody}>
        <Text style={styles.priorityTitle}>{item.title}</Text>
        <Text style={styles.priorityAction}>{item.action}</Text>
        {item.effect ? <Text style={styles.priorityEffect}>→ {item.effect}</Text> : null}
      </View>
    </View>
  );
}

function OptimizationCard({
  item,
  styles,
}: {
  item: MonthAnalysisOptimization;
  styles: RecommendationsStyles;
}) {
  return (
    <View style={styles.optimizationCard}>
      <View style={styles.optimizationBadge}>
        <Text style={styles.optimizationBadgeText}>{OPTIMIZATION_LABELS[item.kind]}</Text>
      </View>
      <Text style={styles.optimizationTitle}>{item.title}</Text>
      <Text style={styles.optimizationAction}>{item.action}</Text>
      {item.benefit ? <Text style={styles.optimizationBenefit}>→ {item.benefit}</Text> : null}
    </View>
  );
}

function createStyles({ colors: c, cardBase, radii }: Parameters<Parameters<typeof useThemedStyles>[0]>[0]) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: 'transparent' },
    container: { flex: 1 },
    contentContainer: { paddingBottom: spacing.xl },
    heroInner: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
    },
    heroEyebrow: {
      ...typography.overline,
      color: heroOnDark.eyebrow,
      letterSpacing: 1.2,
      marginBottom: spacing.sm,
    },
    heroHeadline: {
      ...typography.h2,
      color: heroOnDark.title,
      lineHeight: 30,
    },
    body: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
    },
    situation: {
      ...typography.body,
      lineHeight: 24,
      color: c.textSecondary,
      marginBottom: spacing.lg,
    },
    sectionHint: {
      ...typography.body,
      color: c.textMuted,
      lineHeight: 21,
      marginBottom: spacing.md,
      marginTop: -spacing.xs,
    },
    priorityCard: {
      ...cardBase,
      flexDirection: 'row',
      padding: spacing.md,
      marginBottom: spacing.sm,
      gap: spacing.md,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderColor: c.borderLight,
    },
    priorityIndex: {
      width: 32,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    priorityIndexText: { color: c.accentDark, fontWeight: '800', fontSize: 15 },
    priorityBody: { flex: 1 },
    priorityTitle: { ...typography.h3, fontSize: 17, marginBottom: 6 },
    priorityAction: { ...typography.body, color: c.textSecondary, lineHeight: 22 },
    priorityEffect: {
      marginTop: spacing.sm,
      fontSize: 14,
      lineHeight: 20,
      color: c.incomeDark,
      fontWeight: '600',
    },
    optimizationCard: {
      ...cardBase,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radii.xl,
      borderLeftWidth: 3,
      borderLeftColor: LUXURY_GOLD,
    },
    optimizationBadge: {
      alignSelf: 'flex-start',
      backgroundColor: c.incomeSoft ?? c.accentSoft,
      borderRadius: radii.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: spacing.sm,
    },
    optimizationBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.incomeDark,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    optimizationTitle: { ...typography.h3, fontSize: 17, marginBottom: 6 },
    optimizationAction: { ...typography.body, color: c.textSecondary, lineHeight: 22 },
    optimizationBenefit: {
      marginTop: spacing.sm,
      fontSize: 14,
      lineHeight: 20,
      color: c.incomeDark,
      fontWeight: '600',
    },
    disclaimer: {
      marginTop: spacing.md,
      ...typography.meta,
      lineHeight: 18,
      color: c.textMuted,
    },
    insightRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
    insightCard: {
      flex: 1,
      ...cardBase,
      padding: spacing.md,
      borderRadius: radii.lg,
    },
    insightLabel: {
      ...typography.overline,
      color: c.textMuted,
      marginBottom: 6,
    },
    insightText: { ...typography.body, color: c.textSecondary, lineHeight: 20 },
    watchCard: { borderLeftWidth: 3, borderLeftColor: c.warning },
    strengthCard: { borderLeftWidth: 3, borderLeftColor: c.income },
    legacyCard: {
      ...cardBase,
      padding: spacing.lg,
      borderRadius: radii.xl,
    },
    legacyText: { ...typography.body, lineHeight: 24, color: c.text },
    legacyIconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.md,
    },
    legacyIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surfaceMuted,
    },
  });
}

export function RecommendationsScreen(_props: Props) {
  const route = useRoute();
  const navigation = useNavigation();
  const params = route.params as HomeStackParamList['Recommendations'] | undefined;
  const analysis = params?.analysis;
  const legacyText = params?.recommendations ?? '';
  const monthLabel = params?.monthLabel;

  const styles = useThemedStyles(createStyles);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        backLabel="Главная"
        title="Финансовый разбор"
        subtitle={
          monthLabel
            ? `${monthLabel} · персональные рекомендации`
            : 'Конкретные шаги по вашим тратам'
        }
      />

      {analysis ? (
        <NavyHeroBlock>
          <View style={styles.heroInner}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Ionicons name="sparkles" size={16} color={LUXURY_GOLD} />
              <Text style={styles.heroEyebrow}>AI-разбор месяца</Text>
            </View>
            <Text style={styles.heroHeadline}>{analysis.headline}</Text>
          </View>
        </NavyHeroBlock>
      ) : null}

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.body}>
          {analysis ? (
            <FadeSlideIn>
              <Text style={styles.situation}>{analysis.situation}</Text>

              <SectionLabel>Что сделать в первую очередь</SectionLabel>
              {analysis.priorities.map((item, index) => (
                <PriorityCard key={`${item.title}-${index}`} index={index} item={item} styles={styles} />
              ))}

              {analysis.optimizations.length > 0 ? (
                <>
                  <SectionLabel style={{ marginTop: spacing.md }}>
                    Как сохранить или вернуть
                  </SectionLabel>
                  <Text style={styles.sectionHint}>
                    Вычеты и продукты под ваши цифры — без советов по отдельным бумагам.
                  </Text>
                  {analysis.optimizations.map((item, index) => (
                    <OptimizationCard key={`${item.title}-${index}`} item={item} styles={styles} />
                  ))}
                  <Text style={styles.disclaimer}>
                    Не является индивидуальной финансовой или налоговой консультацией. Перед
                    оформлением проверьте условия у банка и актуальные лимиты вычетов в ФНС.
                  </Text>
                </>
              ) : null}

              <View style={styles.insightRow}>
                <View style={[styles.insightCard, styles.watchCard]}>
                  <Text style={styles.insightLabel}>На контроле</Text>
                  <Text style={styles.insightText}>{analysis.watch}</Text>
                </View>
                <View style={[styles.insightCard, styles.strengthCard]}>
                  <Text style={styles.insightLabel}>Уже хорошо</Text>
                  <Text style={styles.insightText}>{analysis.strength}</Text>
                </View>
              </View>
            </FadeSlideIn>
          ) : (
            <View style={styles.legacyCard}>
              <View style={styles.legacyIconRow}>
                <View style={styles.legacyIcon}>
                  <Ionicons name="bulb-outline" size={22} color={LUXURY_GOLD} />
                </View>
                <Text style={styles.priorityTitle}>Рекомендации появятся после анализа</Text>
              </View>
              <Text style={styles.legacyText}>
                {legacyText || 'На главной нажмите «Разбор месяца» — AI предложит конкретные шаги.'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
