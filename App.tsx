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
import { MainTabs } from './src/navigation/MainTabs';
import { hasSupabase } from './src/lib/supabase';
import { useAuthDeepLink } from './src/hooks/useAuthDeepLink';
import { MIN_SPLASH_MS, SplashLoader } from './src/components/animations/SplashLoader';
import { ShareIntentHandler } from './src/components/ShareIntentHandler';

function AppNavigator() {
  useAuthDeepLink();
  const { session, isLoading } = useAuth();
  const [splashReady, setSplashReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashReady(true), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading || !splashReady) {
    return <SplashLoader />;
  }

  return (
    <>
      {hasSupabase && !session ? <AuthScreen /> : <MainTabs />}
    </>
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
    <SafeAreaProvider>
      <ShareIntentProvider options={{ resetOnBackground: false }}>
        <ThemeProvider>
          <ThemedApp />
        </ThemeProvider>
      </ShareIntentProvider>
    </SafeAreaProvider>
  );
}
