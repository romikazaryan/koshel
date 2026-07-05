import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useAppTheme } from '../../contexts/ThemeContext';
import { typography } from '../../theme/layout';
import { useThemedStyles } from '../../theme/useThemedStyles';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: IconName;
  label: string;
  onPress?: () => void;
  active?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function QuickActionTile({
  icon,
  label,
  onPress,
  active = false,
  disabled = false,
  style,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      tile: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderRadius: radii.lg,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.borderLight,
        ...shadows.soft,
      },
      tileActive: {
        backgroundColor: c.dangerSoft,
        borderColor: c.danger,
      },
      tileDisabled: { opacity: 0.45 },
      iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.accentSoft,
      },
      iconWrapActive: {
        backgroundColor: c.dangerSoft,
      },
      label: {
        ...typography.meta,
        color: c.text,
        fontWeight: '700',
        textAlign: 'center',
      },
      labelActive: { color: c.danger },
    })
  );

  return (
    <TouchableOpacity
      style={[styles.tile, active && styles.tileActive, disabled && styles.tileDisabled, style]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
        <Ionicons
          name={icon}
          size={22}
          color={active ? colors.danger : colors.accentDark}
        />
      </View>
      <Text style={[styles.label, active && styles.labelActive]} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
