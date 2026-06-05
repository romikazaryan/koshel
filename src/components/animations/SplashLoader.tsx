import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { KoshelLogoAnimation } from './KoshelLogoAnimation';

const MIN_SPLASH_MS = 2200;

export function SplashLoader() {
  const { colors } = useAppTheme();
  const hintOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const hintTimer = setTimeout(() => {
      Animated.timing(hintOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 600);

    return () => clearTimeout(hintTimer);
  }, [hintOpacity]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KoshelLogoAnimation />
      <Animated.Text style={[styles.hint, { color: colors.textMuted, opacity: hintOpacity }]}>
        Загружаем ваш кошелёк…
      </Animated.Text>
    </View>
  );
}

export { MIN_SPLASH_MS };

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },
  hint: {
    fontSize: 15,
    fontWeight: '500',
  },
});
