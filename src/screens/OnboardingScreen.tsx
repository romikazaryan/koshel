import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { FadeSlideIn } from '../components/animations/FadeSlideIn';
import { KoshelLogo } from '../components/brand/KoshelLogo';
import { OnboardingProgressBar } from '../components/onboarding/OnboardingProgressBar';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { NavyHeroBlock } from '../components/ui/NavyHeroBlock';
import {
  GOAL_OPTIONS,
  INCOME_OPTIONS,
  ONBOARDING_QUESTION_COUNT,
  SAVINGS_OPTIONS,
  spendingOptionsForIncome,
} from '../constants/onboardingFlow';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import {
  buildOnboardingProfile,
  completeOnboarding,
  setFirstExpensePrompt,
  EMPTY_ONBOARDING_ANSWERS,
  formatOnboardingSummary,
  resolveMonthlyBudgetFromAnswers,
} from '../lib/onboarding';
import { formatMoney } from '../lib/formatMoney';
import { heroOnDark, LUXURY_GOLD } from '../theme/premium';
import { moneyText, spacing, typography } from '../theme/layout';
import { useThemedStyles } from '../theme/useThemedStyles';
import type {
  IncomeRange,
  OnboardingAnswers,
  OnboardingGoal,
  SavingsCushion,
  SpendingPreset,
} from '../types/onboarding';

type StepId = 'welcome' | 'income' | 'spending' | 'savings' | 'goal' | 'complete';

type ChipOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  onComplete: () => void;
  /** Повторное прохождение из профиля (с предзаполнением). */
  mode?: 'initial' | 'retake';
  initialAnswers?: OnboardingAnswers;
  onCancel?: () => void;
};

export function OnboardingScreen({
  onComplete,
  mode = 'initial',
  initialAnswers,
  onCancel,
}: Props) {
  const isRetake = mode === 'retake';
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [step, setStep] = useState<StepId>('welcome');
  const [answers, setAnswers] = useState<OnboardingAnswers>(
    initialAnswers ?? EMPTY_ONBOARDING_ANSWERS
  );
  const [isSaving, setIsSaving] = useState(false);

  const styles = useThemedStyles(({ colors: c, radii, shadows, cardBase }) =>
    StyleSheet.create({
      safe: { flex: 1, backgroundColor: 'transparent' },
      flex: { flex: 1 },
      scroll: { flexGrow: 1, paddingHorizontal: spacing.xl },
      progressWrap: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
      },
      stepBadge: {
        ...typography.overline,
        color: heroOnDark.eyebrow,
        letterSpacing: 1.2,
        marginBottom: spacing.sm,
      },
      heroInner: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
      },
      heroTitle: {
        ...typography.h1,
        color: heroOnDark.title,
        letterSpacing: -0.6,
      },
      heroSubtitle: {
        ...typography.body,
        color: heroOnDark.subtitle,
        marginTop: 6,
        lineHeight: 22,
      },
      welcomeBody: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.xl,
        paddingBottom: spacing.xxl,
      },
      welcomeLogo: { marginBottom: spacing.lg },
      welcomeTitle: {
        ...typography.h1,
        color: c.text,
        textAlign: 'center',
        letterSpacing: -0.6,
        marginBottom: spacing.md,
      },
      welcomeText: {
        ...typography.body,
        color: c.textMuted,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.xl,
      },
      perks: { width: '100%', gap: spacing.sm, marginBottom: spacing.xxl },
      perkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        ...cardBase,
        padding: spacing.md,
        borderRadius: radii.lg,
      },
      perkIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: c.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      },
      perkText: { flex: 1, ...typography.body, color: c.text, fontWeight: '600' },
      questionTitle: {
        ...typography.h2,
        color: c.text,
        marginBottom: spacing.sm,
        letterSpacing: -0.4,
      },
      questionHint: {
        ...typography.body,
        color: c.textMuted,
        lineHeight: 22,
        marginBottom: spacing.lg,
      },
      optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
        marginBottom: spacing.lg,
      },
      optionCard: {
        width: '48%',
        flexGrow: 1,
        minWidth: '46%',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: c.borderLight,
        backgroundColor: c.surface,
        ...shadows.soft,
      },
      optionCardWide: {
        width: '100%',
        minWidth: '100%',
      },
      optionCardActive: {
        borderColor: c.accent,
        backgroundColor: c.accentSoft,
      },
      optionLabel: {
        ...typography.bodyLg,
        color: c.text,
        fontWeight: '700',
      },
      optionLabelActive: { color: c.accentDark },
      optionHint: {
        ...typography.caption,
        color: c.textMuted,
        marginTop: 4,
      },
      optionHintActive: { color: c.accentDark },
      footer: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
        gap: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: c.borderLight,
        backgroundColor: c.surface,
      },
      footerRow: {
        flexDirection: 'row',
        gap: spacing.sm,
      },
      backBtn: {
        width: 48,
        height: 48,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: c.borderLight,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceMuted,
      },
      summaryCard: {
        ...cardBase,
        padding: spacing.lg,
        borderRadius: radii.xl,
        marginBottom: spacing.lg,
        borderLeftWidth: 4,
        borderLeftColor: LUXURY_GOLD,
      },
      summaryTitle: {
        ...typography.overline,
        color: c.textMuted,
        marginBottom: spacing.md,
      },
      summaryLine: {
        ...typography.bodyLg,
        color: c.text,
        fontWeight: '600',
        marginBottom: spacing.sm,
      },
      summaryBudget: {
        fontSize: 32,
        fontWeight: '900',
        color: c.text,
        letterSpacing: -0.8,
        marginBottom: spacing.md,
        ...moneyText,
      },
      completeHint: {
        ...typography.body,
        color: c.textMuted,
        lineHeight: 22,
        marginBottom: spacing.lg,
      },
      topCloseRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xs,
        paddingBottom: spacing.xs,
      },
      topCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceMuted,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
    })
  );

  const questionIndex =
    step === 'income' ? 1 : step === 'spending' ? 2 : step === 'savings' ? 3 : step === 'goal' ? 4 : 0;

  const spendingOptions = useMemo(
    () => spendingOptionsForIncome(answers.incomeRange),
    [answers.incomeRange]
  );

  const previewProfile = useMemo(() => buildOnboardingProfile(answers), [answers]);
  const summaryLines = useMemo(() => formatOnboardingSummary(previewProfile), [previewProfile]);
  const previewBudget = useMemo(() => resolveMonthlyBudgetFromAnswers(answers), [answers]);

  const canAdvance = useMemo(() => {
    switch (step) {
      case 'income':
        return answers.incomeRange != null;
      case 'spending':
        if (answers.spendingPreset === 'custom') {
          const n = Number(answers.customBudget.replace(/\s/g, '').replace(',', '.'));
          return Number.isFinite(n) && n > 0;
        }
        return answers.spendingPreset != null;
      case 'savings':
        return answers.savingsCushion != null;
      case 'goal':
        return answers.primaryGoal != null;
      default:
        return true;
    }
  }, [step, answers]);

  const goNext = () => {
    const order: StepId[] = ['welcome', 'income', 'spending', 'savings', 'goal', 'complete'];
    const idx = order.indexOf(step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  };

  const goBack = () => {
    const order: StepId[] = ['welcome', 'income', 'spending', 'savings', 'goal', 'complete'];
    const idx = order.indexOf(step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const skipStep = () => {
    if (step === 'income') setAnswers((a) => ({ ...a, incomeRange: 'skip' }));
    if (step === 'spending') setAnswers((a) => ({ ...a, spendingPreset: 'skip', customBudget: '' }));
    if (step === 'savings') setAnswers((a) => ({ ...a, savingsCushion: 'skip' }));
    if (step === 'goal') setAnswers((a) => ({ ...a, primaryGoal: 'skip' }));
    goNext();
  };

  const finish = async (openFirstExpense = false) => {
    setIsSaving(true);
    try {
      await completeOnboarding(user?.id ?? null, answers);
      if (openFirstExpense && !isRetake) {
        await setFirstExpensePrompt(user?.id ?? null);
      }
      onComplete();
    } catch (error) {
      console.warn('onboarding complete failed', error);
      if (openFirstExpense && !isRetake) {
        await setFirstExpensePrompt(user?.id ?? null).catch(() => undefined);
      }
      onComplete();
    } finally {
      setIsSaving(false);
    }
  };

  const renderOptions = <T extends string>(
    options: ChipOption[],
    selected: T | null,
    onSelect: (value: T) => void,
    wideLast?: boolean
  ) => (
    <View style={styles.optionsGrid}>
      {options.map((opt, index) => {
        const active = selected === opt.value;
        const isWide = wideLast && index === options.length - 1 && opt.value === 'custom';
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.optionCard,
              isWide && styles.optionCardWide,
              active && styles.optionCardActive,
            ]}
            onPress={() => onSelect(opt.value as T)}
            activeOpacity={0.8}
          >
            <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{opt.label}</Text>
            {opt.hint ? (
              <Text style={[styles.optionHint, active && styles.optionHintActive]}>{opt.hint}</Text>
            ) : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderQuestion = (
    title: string,
    hint: string,
    body: ReactNode
  ) => (
    <FadeSlideIn key={step} fill style={styles.flex}>
      <Text style={styles.questionTitle}>{title}</Text>
      <Text style={styles.questionHint}>{hint}</Text>
      {body}
    </FadeSlideIn>
  );

  let content: ReactNode = null;

  if (step === 'welcome') {
    content = (
      <FadeSlideIn key="welcome" fill style={styles.welcomeBody}>
        <KoshelLogo size={52} style={styles.welcomeLogo} />
        <Text style={styles.welcomeTitle}>
          {isRetake ? 'Стартовый опрос' : 'Настроим Koshel под вас'}
        </Text>
        <Text style={styles.welcomeText}>
          {isRetake
            ? 'Ответы подставлены из профиля — можно изменить любой шаг. Лимит трат на главной обновится после сохранения.'
            : '4 коротких вопроса — около минуты. Ответы помогут собрать дашборд и лимит трат. Всё можно пропустить и изменить позже.'}
        </Text>
        {!isRetake ? (
          <View style={styles.perks}>
            {[
              { icon: 'speedometer-outline' as const, text: 'Лимит трат на главном экране' },
              { icon: 'analytics-outline' as const, text: 'Умнее AI-разбор месяца' },
              { icon: 'shield-checkmark-outline' as const, text: 'Без давления — только вы решаете' },
            ].map((item) => (
              <View key={item.text} style={styles.perkRow}>
                <View style={styles.perkIcon}>
                  <Ionicons name={item.icon} size={20} color={LUXURY_GOLD} />
                </View>
                <Text style={styles.perkText}>{item.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <Button label={isRetake ? 'Пройти заново' : 'Начать'} onPress={goNext} />
      </FadeSlideIn>
    );
  } else if (step === 'income') {
    content = renderQuestion(
      'Сколько вы примерно зарабатываете в месяц?',
      'Не нужна точная цифра — достаточно диапазона. Мы не показываем это никому.',
      renderOptions<IncomeRange>(INCOME_OPTIONS, answers.incomeRange, (value) =>
        setAnswers((a) => ({ ...a, incomeRange: value }))
      )
    );
  } else if (step === 'spending') {
    content = renderQuestion(
      'Сколько планируете тратить в месяц?',
      answers.incomeRange && answers.incomeRange !== 'skip'
        ? 'Подсказали варианты от вашего дохода. Выберите комфортный уровень или укажите сумму.'
        : 'Это станет лимитом на главном экране — можно изменить в любой момент.',
      <>
        {renderOptions<SpendingPreset>(
          spendingOptions,
          answers.spendingPreset,
          (value) => setAnswers((a) => ({ ...a, spendingPreset: value })),
          true
        )}
        {answers.spendingPreset === 'custom' ? (
          <Input
            label="Ваша сумма в месяц, ₽"
            placeholder="Например, 80 000"
            keyboardType="numeric"
            value={answers.customBudget}
            onChangeText={(text) => setAnswers((a) => ({ ...a, customBudget: text }))}
          />
        ) : null}
      </>
    );
  } else if (step === 'savings') {
    content = renderQuestion(
      'Есть ли финансовая подушка?',
      'Запас на непредвиденные расходы. Поможет точнее оценивать риски в разборе месяца.',
      renderOptions<SavingsCushion>(SAVINGS_OPTIONS, answers.savingsCushion, (value) =>
        setAnswers((a) => ({ ...a, savingsCushion: value }))
      )
    );
  } else if (step === 'goal') {
    content = renderQuestion(
      'Что для вас сейчас главное?',
      'Так мы поймём, на что сделать акцент в приложении.',
      renderOptions<OnboardingGoal>(GOAL_OPTIONS, answers.primaryGoal, (value) =>
        setAnswers((a) => ({ ...a, primaryGoal: value }))
      )
    );
  } else if (step === 'complete') {
    content = (
      <FadeSlideIn key="complete" fill>
        <Text style={styles.questionTitle}>
          {isRetake ? 'Изменения сохранены' : 'Готово — дашборд настроен'}
        </Text>
        <Text style={styles.completeHint}>
          {isRetake
            ? 'Лимит трат и профиль обновлены. Проверьте главный экран.'
            : 'Можно сразу добавить трату, загрузить выписку или посмотреть раздел «Финансы».'}
        </Text>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Ваш профиль</Text>
          {previewBudget != null ? (
            <Text style={styles.summaryBudget}>{formatMoney(previewBudget)}</Text>
          ) : null}
          {summaryLines.map((line) => (
            <Text key={line} style={styles.summaryLine}>
              {line}
            </Text>
          ))}
        </View>
      </FadeSlideIn>
    );
  }

  const showHero = step !== 'welcome' && step !== 'complete';
  const showFooter = step !== 'welcome';
  const showSkip = step === 'income' || step === 'spending' || step === 'savings' || step === 'goal';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {step === 'welcome' && isRetake && onCancel ? (
        <View style={styles.topCloseRow}>
          <TouchableOpacity
            style={styles.topCloseBtn}
            onPress={onCancel}
            accessibilityLabel="Закрыть"
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}

      {step !== 'welcome' && step !== 'complete' ? (
        <View style={styles.progressWrap}>
          <OnboardingProgressBar current={questionIndex} total={ONBOARDING_QUESTION_COUNT} />
        </View>
      ) : null}

      {showHero ? (
        <NavyHeroBlock>
          <View style={styles.heroInner}>
            <Text style={styles.stepBadge}>
              Вопрос {questionIndex} из {ONBOARDING_QUESTION_COUNT}
            </Text>
            <Text style={styles.heroTitle}>
              {isRetake ? 'Обновление профиля' : 'Быстрая настройка'}
            </Text>
            <Text style={styles.heroSubtitle}>Можно пропустить любой шаг</Text>
          </View>
        </NavyHeroBlock>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>

        {showFooter ? (
          <View style={styles.footer}>
            {step === 'complete' ? (
              isRetake ? (
                <Button
                  label="Вернуться в профиль"
                  onPress={() => void finish(false)}
                  loading={isSaving}
                  disabled={isSaving}
                />
              ) : (
                <>
                  <Button
                    label="Добавить первую трату"
                    onPress={() => void finish(true)}
                    loading={isSaving}
                    disabled={isSaving}
                  />
                  <Button
                    label="Открыть дашборд"
                    variant="ghost"
                    onPress={() => void finish(false)}
                    disabled={isSaving}
                    style={{ marginTop: 4 }}
                  />
                </>
              )
            ) : (
              <>
                <View style={styles.footerRow}>
                  {step !== 'income' ? (
                    <TouchableOpacity style={styles.backBtn} onPress={goBack} accessibilityLabel="Назад">
                      <Ionicons name="chevron-back" size={22} color={colors.accentDark} />
                    </TouchableOpacity>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Далее"
                      onPress={goNext}
                      disabled={!canAdvance}
                    />
                  </View>
                </View>
                {showSkip ? (
                  <Button label="Пропустить вопрос" variant="ghost" onPress={skipStep} />
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </KeyboardAvoidingView>

      {isSaving ? (
        <View
          style={{
            ...StyleSheet.absoluteFill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.15)',
          }}
          pointerEvents="none"
        >
          <ActivityIndicator size="large" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
