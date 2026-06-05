import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
};

export function SegmentedControl<T extends string>({ options, value, onChange, style }: Props<T>) {
  const styles = useThemedStyles(({ colors, radii }) =>
    StyleSheet.create({
      track: {
        flexDirection: 'row',
        backgroundColor: colors.primarySoft,
        borderRadius: radii.md,
        padding: 4,
        marginBottom: 16,
      },
      item: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: radii.sm,
      },
      itemActive: {
        backgroundColor: colors.surface,
        shadowColor: colors.shadow,
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
      },
      label: {
        fontWeight: '600',
        fontSize: 14,
        color: colors.textMuted,
      },
      labelActive: {
        color: colors.text,
        fontWeight: '700',
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
          >
            <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
