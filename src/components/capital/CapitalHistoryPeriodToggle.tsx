import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import {
  getHistoryPeriodCycleLabel,
  getNextHistoryPeriod,
  type CapitalHistoryPeriod,
} from '../../constants/capitalFilters';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  value: CapitalHistoryPeriod;
  onChange: (period: CapitalHistoryPeriod) => void;
};

export function CapitalHistoryPeriodToggle({ value, onChange }: Props) {
  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      button: {
        alignSelf: 'flex-end',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radii.pill,
        backgroundColor: c.surfaceMuted,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      label: {
        fontSize: 11,
        fontWeight: '700',
        color: c.textMuted,
        letterSpacing: 0.2,
        textTransform: 'uppercase',
      },
    })
  );

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => onChange(getNextHistoryPeriod(value))}
      activeOpacity={0.65}
      accessibilityRole="button"
      accessibilityLabel={`Период динамики: ${getHistoryPeriodCycleLabel(value)}. Нажмите для смены`}
    >
      <Text style={styles.label}>{getHistoryPeriodCycleLabel(value)}</Text>
    </TouchableOpacity>
  );
}
