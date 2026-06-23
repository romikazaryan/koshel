import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { AppAtmosphereBackground } from './AppAtmosphereBackground';

type Props = {
  children: ReactNode;
};

/** Корневой контейнер с базовым цветом и атмосферным фоном. */
export function AppScreenShell({ children }: Props) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AppAtmosphereBackground />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
