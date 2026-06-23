import { useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HomeStackParamList } from '../navigation/types';
import type { MonthAnalysisOptimization, MonthAnalysisResult } from '../types/monthAnalysis';
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
    safeArea: { flex: 1, backgroundColor: c.background },
    container: { flex: 1 },
    contentContainer: { padding: 20, paddingBottom: 40 },
    backButton: { marginBottom: 12 },
    backText: { color: c.accentDark, fontWeight: '600', fontSize: 16 },
    headerWrap: { marginBottom: 18 },
    title: { fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 6 },
    subtitle: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
    headlineCard: {
      ...cardBase,
      padding: 20,
      marginBottom: 14,
      borderLeftWidth: 4,
      borderLeftColor: c.accent,
    },
    headline: { fontSize: 20, fontWeight: '800', color: c.text, lineHeight: 28 },
    situation: {
      fontSize: 15,
      lineHeight: 23,
      color: c.textSecondary,
      marginBottom: 18,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    sectionHint: {
      fontSize: 13,
      lineHeight: 19,
      color: c.textMuted,
      marginBottom: 12,
      marginTop: -4,
    },
    priorityCard: {
      ...cardBase,
      flexDirection: 'row',
      padding: 16,
      marginBottom: 10,
      gap: 12,
    },
    priorityIndex: {
      width: 28,
      height: 28,
      borderRadius: radii.pill,
      backgroundColor: c.accentSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    priorityIndexText: { color: c.accentDark, fontWeight: '800', fontSize: 14 },
    priorityBody: { flex: 1 },
    priorityTitle: { fontSize: 16, fontWeight: '800', color: c.text, marginBottom: 6 },
    priorityAction: { fontSize: 15, lineHeight: 22, color: c.textSecondary },
    priorityEffect: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: c.incomeDark,
      fontWeight: '600',
    },
    optimizationCard: {
      ...cardBase,
      padding: 16,
      marginBottom: 10,
      borderLeftWidth: 3,
      borderLeftColor: c.income,
    },
    optimizationBadge: {
      alignSelf: 'flex-start',
      backgroundColor: c.incomeSoft ?? c.accentSoft,
      borderRadius: radii.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 8,
    },
    optimizationBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.incomeDark,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    optimizationTitle: { fontSize: 16, fontWeight: '800', color: c.text, marginBottom: 6 },
    optimizationAction: { fontSize: 15, lineHeight: 22, color: c.textSecondary },
    optimizationBenefit: {
      marginTop: 8,
      fontSize: 14,
      lineHeight: 20,
      color: c.incomeDark,
      fontWeight: '600',
    },
    disclaimer: {
      marginTop: 14,
      fontSize: 12,
      lineHeight: 18,
      color: c.textMuted,
    },
    insightRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
    insightCard: {
      flex: 1,
      ...cardBase,
      padding: 14,
      marginBottom: 0,
    },
    insightLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    insightText: { fontSize: 14, lineHeight: 20, color: c.textSecondary },
    watchCard: { borderLeftWidth: 3, borderLeftColor: c.warning },
    strengthCard: { borderLeftWidth: 3, borderLeftColor: c.income },
    legacyCard: {
      backgroundColor: c.surface,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: c.border,
    },
    legacyText: { color: c.text, fontSize: 15, lineHeight: 24 },
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
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Назад</Text>
        </TouchableOpacity>

        <View style={styles.headerWrap}>
          <Text style={styles.title}>Финансовый разбор</Text>
          <Text style={styles.subtitle}>
            {monthLabel
              ? `${monthLabel} · персональные рекомендации`
              : 'Конкретные шаги по вашим тратам'}
          </Text>
        </View>

        {analysis ? (
          <>
            <View style={styles.headlineCard}>
              <Text style={styles.headline}>{analysis.headline}</Text>
            </View>

            <Text style={styles.situation}>{analysis.situation}</Text>

            <Text style={styles.sectionTitle}>Что сделать в первую очередь</Text>
            {analysis.priorities.map((item, index) => (
              <PriorityCard key={`${item.title}-${index}`} index={index} item={item} styles={styles} />
            ))}

            {analysis.optimizations.length > 0 ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Как сохранить или вернуть</Text>
                <Text style={styles.sectionHint}>
                  Вычеты и продукты, которые подходят под ваши цифры — без советов по отдельным бумагам.
                </Text>
                {analysis.optimizations.map((item, index) => (
                  <OptimizationCard key={`${item.title}-${index}`} item={item} styles={styles} />
                ))}
                <Text style={styles.disclaimer}>
                  Не является индивидуальной финансовой или налоговой консультацией. Перед оформлением
                  проверьте условия у банка и актуальные лимиты вычетов в ФНС.
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
          </>
        ) : (
          <View style={styles.legacyCard}>
            <Text style={styles.legacyText}>
              {legacyText || 'Здесь появятся рекомендации после анализа.'}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
