import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PAYMENT_DAY_MAX, PAYMENT_DAY_MIN } from '../lib/paymentDay';
import { useThemedStyles } from '../theme/useThemedStyles';
import { VerticalCarouselColumn } from './VerticalCarouselColumn';

type Props = {
  value: number;
  onChange: (day: number) => void;
  hint?: string;
};

export function PaymentDayCarouselPicker({ value, onChange, hint }: Props) {
  const days = useMemo(
    () =>
      Array.from({ length: PAYMENT_DAY_MAX - PAYMENT_DAY_MIN + 1 }, (_, i) =>
        String(i + PAYMENT_DAY_MIN)
      ),
    []
  );

  const selectedIndex = Math.max(0, Math.min(value - PAYMENT_DAY_MIN, days.length - 1));

  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      wrap: {
        marginBottom: 10,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
        backgroundColor: c.backgroundDeep,
        overflow: 'hidden',
        alignItems: 'center',
      },
      header: {
        paddingTop: 10,
        paddingBottom: 2,
        width: '100%',
      },
      headerCell: {
        fontSize: 11,
        fontWeight: '700',
        color: c.textMuted,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      },
      hint: {
        fontSize: 13,
        color: c.textMuted,
        lineHeight: 18,
        textAlign: 'center',
        paddingHorizontal: 16,
        paddingBottom: 8,
      },
      wheel: {
        paddingBottom: 6,
        width: 120,
      },
    })
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.headerCell}>День списания</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      <View style={styles.wheel}>
        <VerticalCarouselColumn
          width={120}
          items={days}
          selectedIndex={selectedIndex}
          onSelectIndex={(index) => onChange(index + PAYMENT_DAY_MIN)}
        />
      </View>
    </View>
  );
}
