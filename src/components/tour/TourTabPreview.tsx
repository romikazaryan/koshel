import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { hexToRgba } from '../../lib/colorUtils';
import { LUXURY_GOLD } from '../../theme/premium';
import { spacing, typography } from '../../theme/layout';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { AppTourTabHighlight } from '../../types/appTour';

const TABS: {
  id: AppTourTabHighlight;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'Home', label: 'Главная', icon: 'home-outline', iconActive: 'home' },
  { id: 'Finances', label: 'Финансы', icon: 'wallet-outline', iconActive: 'wallet' },
  { id: 'Profile', label: 'Профиль', icon: 'person-circle-outline', iconActive: 'person-circle' },
];

type Props = {
  highlight?: AppTourTabHighlight | null;
};

export function TourTabPreview({ highlight = null }: Props) {
  const { colors, isDark } = useAppTheme();

  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      wrap: {
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: c.borderLight,
        backgroundColor: c.surface,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        ...shadows.soft,
      },
      label: {
        ...typography.overline,
        color: c.textMuted,
        textAlign: 'center',
        marginBottom: spacing.sm,
        letterSpacing: 1,
      },
      row: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
      },
      tab: {
        alignItems: 'center',
        gap: 4,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        borderRadius: radii.lg,
        minWidth: 72,
      },
      tabActive: {
        backgroundColor: hexToRgba(colors.accent, isDark ? 0.18 : 0.12),
      },
      tabLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: c.textMuted,
      },
      tabLabelActive: {
        color: c.accentDark,
        fontWeight: '700',
      },
      dot: {
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: LUXURY_GOLD,
        marginTop: 2,
      },
    })
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Навигация внизу</Text>
      <View style={styles.row}>
        {TABS.map((tab) => {
          const active = highlight === tab.id;
          return (
            <View key={tab.id} style={[styles.tab, active && styles.tabActive]}>
              <Ionicons
                name={active ? tab.iconActive : tab.icon}
                size={22}
                color={active ? colors.accentDark : colors.textMuted}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              {active ? <View style={styles.dot} /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
