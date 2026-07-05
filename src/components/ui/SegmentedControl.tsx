import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { typography } from '../../theme/layout';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
};

export function SegmentedControl<T extends string>({ options, value, onChange, style }: Props<T>) {
  const styles = useThemedStyles(({ colors, radii, shadows }) =>
    StyleSheet.create({
      track: {
        flexDirection: 'row',
        backgroundColor: colors.backgroundDeep,
        borderRadius: radii.lg,
        padding: 4,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.borderLight,
      },
      item: {
        flex: 1,
        paddingVertical: 11,
        alignItems: 'center',
        borderRadius: radii.md,
      },
      itemActive: {
        backgroundColor: colors.surface,
        ...shadows.soft,
      },
      label: {
        ...typography.meta,
        color: colors.textMuted,
        fontWeight: '600',
      },
      labelActive: {
        color: colors.text,
        fontWeight: '800',
      },
    })
  );

  return (
    <View style={[styles.track, style]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.item, active && styles.itemActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
