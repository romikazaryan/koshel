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
  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      button: {
        paddingVertical: 2,
        paddingHorizontal: 2,
      },
      label: {
        fontSize: 13,
        fontWeight: '500',
        color: c.textMuted,
        letterSpacing: 0.1,
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
