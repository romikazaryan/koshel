import { ScrollView, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { useThemedStyles } from '../../theme/useThemedStyles';

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type Props<T extends string> = {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: ViewStyle;
};

export function HorizontalChipCarousel<T extends string>({
  options,
  value,
  onChange,
  style,
}: Props<T>) {
  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      wrap: {
        marginBottom: 12,
      },
      scroll: {
        flexGrow: 0,
      },
      content: {
        paddingRight: 4,
        gap: 8,
        flexDirection: 'row',
      },
      chip: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.backgroundDeep,
      },
      chipActive: {
        backgroundColor: c.accentSoft,
        borderColor: c.accent,
      },
      chipText: {
        fontSize: 14,
        fontWeight: '600',
        color: c.textMuted,
      },
      chipTextActive: {
        color: c.accentDark,
        fontWeight: '700',
      },
      count: {
        color: c.textMuted,
        fontWeight: '600',
      },
      countActive: {
        color: c.accentDark,
      },
    })
  );

  if (options.length <= 1) return null;

  return (
    <View style={[styles.wrap, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => onChange(option.value)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {option.label}
                {option.count != null ? (
                  <Text style={[styles.count, active && styles.countActive]}> · {option.count}</Text>
                ) : null}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
