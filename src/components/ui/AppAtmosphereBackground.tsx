import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';

/** Декоративные «круги» на фоне — как в шапке главной. */
export function AppAtmosphereBackground() {
  const { isDark } = useAppTheme();
  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      root: {
        ...StyleSheet.absoluteFill,
      },
      orbTopIncome: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: 150,
        top: -118,
        right: -88,
        backgroundColor: c.income,
        opacity: isDark ? 0.14 : 0.1,
      },
      orbTopExpense: {
        position: 'absolute',
        width: 250,
        height: 250,
        borderRadius: 125,
        top: -52,
        left: -96,
        backgroundColor: c.expense,
        opacity: isDark ? 0.11 : 0.075,
      },
      orbMidAccent: {
        position: 'absolute',
        width: 210,
        height: 210,
        borderRadius: 105,
        top: '34%',
        right: -76,
        backgroundColor: c.accent,
        opacity: isDark ? 0.09 : 0.06,
      },
      orbLowPrimary: {
        position: 'absolute',
        width: 340,
        height: 340,
        borderRadius: 170,
        bottom: -150,
        left: -130,
        backgroundColor: c.primary,
        opacity: isDark ? 0.08 : 0.05,
      },
      orbLowAccent: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        bottom: '20%',
        right: -36,
        backgroundColor: c.accent,
        opacity: isDark ? 0.07 : 0.045,
      },
    })
  );

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={styles.orbTopIncome} />
      <View style={styles.orbTopExpense} />
      <View style={styles.orbMidAccent} />
      <View style={styles.orbLowPrimary} />
      <View style={styles.orbLowAccent} />
    </View>
  );
}
