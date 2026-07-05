import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { ShareIntentProvider } from 'expo-share-intent';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { ThemeProvider, useAppTheme } from './src/contexts/ThemeContext';
import { PendingQuickCaptureProvider } from './src/contexts/PendingQuickCaptureContext';
import { SharedStatementProvider } from './src/contexts/SharedStatementContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { MainTabs } from './src/navigation/MainTabs';
import { hasSupabase } from './src/lib/supabase';
import { fetchOnboardingCompleted } from './src/lib/onboarding';
import { fetchAppTourCompleted } from './src/lib/appTour';
import { useAuthDeepLink } from './src/hooks/useAuthDeepLink';
import { MIN_SPLASH_MS, SplashLoader } from './src/components/animations/SplashLoader';
import { ShareIntentHandler } from './src/components/ShareIntentHandler';
import { AppScreenShell } from './src/components/ui/AppScreenShell';
import { AppTourScreen } from './src/screens/AppTourScreen';

function AppNavigator() {
  useAuthDeepLink();
  const { session, user, isLoading } = useAuth();
  const [splashReady, setSplashReady] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(true);
  const [appTourChecked, setAppTourChecked] = useState(false);
  const [appTourDone, setAppTourDone] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setSplashReady(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkOnboarding() {
      if (!splashReady || isLoading) return;

      if (hasSupabase && !session) {
        if (!cancelled) {
          setOnboardingDone(true);
          setOnboardingChecked(true);
        }
        return;
      }

      // Ждём user.id, иначе проверка уйдёт с null и покажет опрос снова.
      if (session && !user?.id) return;

      const done = await fetchOnboardingCompleted(user?.id ?? null);
      if (!cancelled) {
        setOnboardingDone(done);
        setOnboardingChecked(true);
      }
    }

    void checkOnboarding();
    return () => {
      cancelled = true;
    };
  }, [splashReady, isLoading, session, user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function checkAppTour() {
      if (!splashReady || isLoading || !onboardingChecked) return;

      if (!onboardingDone || (hasSupabase && !session)) {
        if (!cancelled) {
          setAppTourDone(true);
          setAppTourChecked(true);
        }
        return;
      }

      if (session && !user?.id) return;

      const done = await fetchAppTourCompleted(user?.id ?? null);
      if (!cancelled) {
        setAppTourDone(done);
        setAppTourChecked(true);
      }
    }

    void checkAppTour();
    return () => {
      cancelled = true;
    };
  }, [splashReady, isLoading, session, user?.id, onboardingChecked, onboardingDone]);

  if (isLoading || !splashReady || !onboardingChecked || (onboardingDone && !appTourChecked)) {
    return <SplashLoader />;
  }

  return (
    <AppScreenShell>
      {hasSupabase && !session ? (
        <AuthScreen />
      ) : !onboardingDone ? (
        <OnboardingScreen onComplete={() => setOnboardingDone(true)} />
      ) : !appTourDone ? (
        <AppTourScreen onComplete={() => setAppTourDone(true)} />
      ) : (
        <MainTabs />
      )}
    </AppScreenShell>
  );
}

function ThemedApp() {
  const { colors, isDark } = useAppTheme();

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          primary: colors.accent,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          primary: colors.accent,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
        },
      };

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <NavigationContainer theme={navTheme}>
        <AuthProvider>
          <PendingQuickCaptureProvider>
            <SharedStatementProvider>
              <ShareIntentHandler />
              <AppNavigator />
            </SharedStatementProvider>
          </PendingQuickCaptureProvider>
        </AuthProvider>
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ShareIntentProvider options={{ resetOnBackground: false }}>
          <ThemeProvider>
            <ThemedApp />
          </ThemeProvider>
        </ShareIntentProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
