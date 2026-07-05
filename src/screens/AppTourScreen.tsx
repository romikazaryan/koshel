import { useState } from 'react';
import {
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
import { TourTabPreview } from '../components/tour/TourTabPreview';
import { Button } from '../components/ui/Button';
import { NavyHeroBlock } from '../components/ui/NavyHeroBlock';
import {
  APP_TOUR_FEATURE_STEP_COUNT,
  APP_TOUR_STEP_ORDER,
  appTourFeatureIndex,
  appTourStepDef,
} from '../constants/appTourFlow';
import { useAuth } from '../contexts/AuthContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { completeAppTour } from '../lib/appTour';
import { heroOnDark, LUXURY_GOLD } from '../theme/premium';
import { moneyText, spacing, typography } from '../theme/layout';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppTourStepId } from '../types/appTour';

type Props = {
  onComplete: () => void;
  mode?: 'initial' | 'retake';
  onCancel?: () => void;
};

export function AppTourScreen({ onComplete, mode = 'initial', onCancel }: Props) {
  const isRetake = mode === 'retake';
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [step, setStep] = useState<AppTourStepId>('welcome');
  const [isFinishing, setIsFinishing] = useState(false);

  const stepIndex = APP_TOUR_STEP_ORDER.indexOf(step);
  const featureIndex = appTourFeatureIndex(step);
  const featureStep = appTourStepDef(step);

  const styles = useThemedStyles(({ colors: c, radii, shadows, cardBase }) =>
    StyleSheet.create({
      safe: { flex: 1, backgroundColor: 'transparent' },
      flex: { flex: 1 },
      scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
      progressWrap: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.sm,
        paddingBottom: spacing.md,
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
      heroInner: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
      },
      stepBadge: {
        ...typography.overline,
        color: heroOnDark.eyebrow,
        letterSpacing: 1.2,
        marginBottom: spacing.sm,
      },
      heroTitle: {
        ...typography.h1,
        color: heroOnDark.title,
        fontSize: 26,
        lineHeight: 32,
        marginBottom: spacing.xs,
      },
      heroSubtitle: {
        ...typography.body,
        color: heroOnDark.subtitle,
        lineHeight: 22,
      },
      welcomeBody: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
      },
      welcomeLogo: { marginBottom: spacing.lg },
      welcomeTitle: {
        ...typography.h1,
        textAlign: 'center',
        marginBottom: spacing.md,
      },
      welcomeText: {
        ...typography.body,
        color: c.textMuted,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: spacing.xl,
        maxWidth: 320,
      },
      perks: {
        alignSelf: 'stretch',
        gap: spacing.sm,
        marginBottom: spacing.xl,
      },
      perkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: c.surface,
        borderRadius: radii.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: c.borderLight,
        ...shadows.soft,
      },
      perkIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceMuted,
      },
      perkText: {
        flex: 1,
        ...typography.body,
        fontWeight: '600',
        color: c.text,
      },
      stepTitle: {
        ...typography.h2,
        marginTop: spacing.lg,
        marginBottom: spacing.sm,
      },
      stepHint: {
        ...typography.body,
        color: c.textMuted,
        lineHeight: 22,
        marginBottom: spacing.lg,
      },
      mockCard: {
        ...cardBase,
        borderRadius: radii.xl,
        padding: spacing.lg,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      mockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
      },
      mockIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceMuted,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      mockEyebrow: {
        ...typography.overline,
        color: c.textMuted,
        marginBottom: 2,
      },
      mockTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: c.text,
      },
      mockValue: {
        ...moneyText,
        fontSize: 28,
        color: c.text,
        marginBottom: spacing.xs,
      },
      mockHint: {
        fontSize: 14,
        color: c.textMuted,
      },
      featureList: { gap: spacing.sm, marginBottom: spacing.lg },
      featureRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingVertical: spacing.sm,
      },
      featureIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceMuted,
        marginTop: 1,
      },
      featureText: {
        flex: 1,
        ...typography.body,
        color: c.text,
        lineHeight: 22,
      },
      completeCard: {
        ...cardBase,
        borderRadius: radii.xl,
        padding: spacing.lg,
        marginTop: spacing.md,
        marginBottom: spacing.lg,
        gap: spacing.sm,
      },
      completeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      },
      completeIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceMuted,
      },
      completeText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        color: c.text,
        lineHeight: 21,
      },
      footer: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.md,
        paddingBottom: spacing.lg,
        gap: spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: c.borderLight,
        backgroundColor: c.background,
      },
      footerRow: {
        flexDirection: 'row',
        gap: spacing.sm,
      },
      footerSide: { flex: 1 },
      skipBtn: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
      },
      skipText: {
        fontSize: 15,
        fontWeight: '600',
        color: c.textMuted,
      },
    })
  );

  const goNext = () => {
    const next = APP_TOUR_STEP_ORDER[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = APP_TOUR_STEP_ORDER[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const finish = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      if (!isRetake) {
        await completeAppTour(user?.id ?? null);
      }
      onComplete();
    } finally {
      setIsFinishing(false);
    }
  };

  const skipTour = async () => {
    if (isRetake) {
      onCancel?.();
      return;
    }
    await finish();
  };

  const welcomePerks = [
    { icon: 'home-outline' as const, text: 'Главная — бюджет и операции' },
    { icon: 'wallet-outline' as const, text: 'Финансы — капитал и активы' },
    { icon: 'person-circle-outline' as const, text: 'Профиль — банки и настройки' },
  ];

  let content = null;

  if (step === 'welcome') {
    content = (
      <FadeSlideIn key="welcome" fill style={styles.welcomeBody}>
        <KoshelLogo size={52} style={styles.welcomeLogo} />
        <Text style={styles.welcomeTitle}>
          {isRetake ? 'Тур по приложению' : 'Добро пожаловать в Koshel'}
        </Text>
        <Text style={styles.welcomeText}>
          {isRetake
            ? 'Короткий обзор ключевых разделов — удобно для тестирования и напоминания.'
            : 'За минуту покажем, где добавлять траты, смотреть капитал и подключать банки. Можно пропустить.'}
        </Text>
        <View style={styles.perks}>
          {welcomePerks.map((item) => (
            <View key={item.text} style={styles.perkRow}>
              <View style={styles.perkIcon}>
                <Ionicons name={item.icon} size={20} color={LUXURY_GOLD} />
              </View>
              <Text style={styles.perkText}>{item.text}</Text>
            </View>
          ))}
        </View>
        <TourTabPreview />
        <View style={{ height: spacing.lg }} />
        <Button label={isRetake ? 'Начать тур' : 'Показать приложение'} onPress={goNext} />
      </FadeSlideIn>
    );
  } else if (featureStep) {
    content = (
      <FadeSlideIn key={step} fill style={styles.flex}>
        <Text style={styles.stepTitle}>{featureStep.title}</Text>
        <Text style={styles.stepHint}>{featureStep.subtitle}</Text>

        <View style={styles.mockCard}>
          <View style={styles.mockHeader}>
            <View style={styles.mockIconWrap}>
              <Ionicons name={featureStep.icon} size={24} color={LUXURY_GOLD} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.mockEyebrow}>{featureStep.eyebrow}</Text>
              <Text style={styles.mockTitle}>{featureStep.mockLabel}</Text>
            </View>
          </View>
          <Text style={styles.mockValue}>{featureStep.mockValue}</Text>
          <Text style={styles.mockHint}>{featureStep.mockHint}</Text>
        </View>

        <View style={styles.featureList}>
          {featureStep.features.map((f) => (
            <View key={f.text} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Ionicons name={f.icon} size={17} color={colors.accentDark} />
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        <TourTabPreview highlight={featureStep.tabHighlight} />
      </FadeSlideIn>
    );
  } else if (step === 'complete') {
    content = (
      <FadeSlideIn key="complete" fill>
        <Text style={styles.stepTitle}>
          {isRetake ? 'Тур завершён' : 'Всё готово — можно пользоваться'}
        </Text>
        <Text style={styles.stepHint}>
          {isRetake
            ? 'Разделы на месте. Тур всегда доступен в профиле.'
            : 'Переключайтесь табами внизу. Тур можно пройти снова в разделе «Профиль».'}
        </Text>

        <View style={styles.completeCard}>
          {[
            { icon: 'home' as const, text: 'Главная — дашборд, операции, импорт' },
            { icon: 'wallet' as const, text: 'Финансы — капитал и котировки' },
            { icon: 'person-circle' as const, text: 'Профиль — банки, лимит, опрос' },
          ].map((row) => (
            <View key={row.text} style={styles.completeRow}>
              <View style={styles.completeIcon}>
                <Ionicons name={row.icon} size={18} color={LUXURY_GOLD} />
              </View>
              <Text style={styles.completeText}>{row.text}</Text>
            </View>
          ))}
        </View>

        <TourTabPreview />
      </FadeSlideIn>
    );
  }

  const showHero = featureStep != null;
  const showProgress = featureStep != null;
  const showFooter = step !== 'welcome';

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

      {showProgress ? (
        <View style={styles.progressWrap}>
          <OnboardingProgressBar
            current={featureIndex}
            total={APP_TOUR_FEATURE_STEP_COUNT}
          />
        </View>
      ) : null}

      {showHero && featureStep ? (
        <NavyHeroBlock>
          <View style={styles.heroInner}>
            <Text style={styles.stepBadge}>
              {featureIndex} из {APP_TOUR_FEATURE_STEP_COUNT} · {featureStep.eyebrow}
            </Text>
            <Text style={styles.heroTitle}>{featureStep.title}</Text>
            <Text style={styles.heroSubtitle}>{featureStep.subtitle}</Text>
          </View>
        </NavyHeroBlock>
      ) : null}

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {content}
      </ScrollView>

      {showFooter ? (
        <View style={styles.footer}>
          {step === 'complete' ? (
            <Button
              label={isRetake ? 'Вернуться в профиль' : 'Открыть приложение'}
              onPress={() => void finish()}
              loading={isFinishing}
              disabled={isFinishing}
            />
          ) : (
            <View style={styles.footerRow}>
              <View style={styles.footerSide}>
                <Button label="Назад" variant="ghost" onPress={goBack} />
              </View>
              <View style={styles.footerSide}>
                <Button label="Далее" onPress={goNext} />
              </View>
            </View>
          )}
          {!isRetake || step !== 'complete' ? (
            <TouchableOpacity style={styles.skipBtn} onPress={() => void skipTour()}>
              <Text style={styles.skipText}>
                {isRetake ? 'Закрыть' : 'Пропустить тур'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
