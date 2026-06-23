import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import {
  chartPaletteDark,
  chartPaletteLight,
  darkColors,
  lightColors,
  type ColorPalette,
} from '../theme/colors';
import { createThemeLayout, moneyText, radii, spacing, typography } from '../theme/layout';

const STORAGE_KEY = '@koshel/theme-preference';

export type ThemePreference = 'system' | 'light' | 'dark';

export type AppTheme = {
  colors: ColorPalette;
  chartPalette: string[];
  shadows: ReturnType<typeof createThemeLayout>['shadows'];
  cardBase: ReturnType<typeof createThemeLayout>['cardBase'];
  radii: typeof radii;
  spacing: typeof spacing;
  typography: typeof typography;
  moneyText: typeof moneyText;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (value: ThemePreference) => void;
};

const ThemeContext = createContext<AppTheme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setPreferenceState(stored);
      }
    });
  }, []);

  const setPreference = useCallback((value: ThemePreference) => {
    setPreferenceState(value);
    void AsyncStorage.setItem(STORAGE_KEY, value);
  }, []);

  const isDark =
    preference === 'dark' || (preference === 'system' && systemScheme === 'dark');

  const value = useMemo<AppTheme>(() => {
    const colors = isDark ? darkColors : lightColors;
    const { shadows, cardBase } = createThemeLayout(colors);
    return {
      colors,
      chartPalette: isDark ? chartPaletteDark : chartPaletteLight,
      shadows,
      cardBase,
      radii,
      spacing,
      typography,
      moneyText,
      isDark,
      preference,
      setPreference,
    };
  }, [isDark, preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within ThemeProvider');
  }
  return ctx;
}
