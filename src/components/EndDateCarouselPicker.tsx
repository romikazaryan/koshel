import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { daysInMonth, formatIsoDate, parseIsoDate } from '../lib/endDate';
import { useThemedStyles } from '../theme/useThemedStyles';
import { VerticalCarouselColumn } from './VerticalCarouselColumn';

const MONTH_LABELS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const YEAR_SPAN = 30;

type Props = {
  value: string;
  onChange: (date: string) => void;
};

export function EndDateCarouselPicker({ value, onChange }: Props) {
  const parsed = parseIsoDate(value);
  const todayYear = new Date().getFullYear();
  const year = parsed?.year ?? todayYear + 3;
  const month = parsed?.month ?? new Date().getMonth() + 1;
  const day = parsed?.day ?? new Date().getDate();

  const years = useMemo(
    () => Array.from({ length: YEAR_SPAN + 1 }, (_, i) => String(todayYear + i)),
    [todayYear]
  );

  const months = useMemo(() => MONTH_LABELS, []);

  const days = useMemo(() => {
    const count = daysInMonth(year, month);
    return Array.from({ length: count }, (_, i) => String(i + 1));
  }, [year, month]);

  const yearIndex = Math.max(0, years.indexOf(String(year)));
  const monthIndex = Math.max(0, month - 1);
  const dayIndex = Math.max(0, Math.min(day - 1, days.length - 1));

  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      wrap: {
        marginBottom: 10,
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 12,
        backgroundColor: c.backgroundDeep,
        overflow: 'hidden',
      },
      header: {
        flexDirection: 'row',
        paddingTop: 10,
        paddingHorizontal: 8,
        paddingBottom: 2,
      },
      headerCell: {
        fontSize: 11,
        fontWeight: '700',
        color: c.textMuted,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
      },
      dayCol: { width: 56 },
      monthCol: { flex: 1 },
      yearCol: { width: 72 },
      columns: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 6,
      },
      divider: {
        width: 1,
        height: 88,
        backgroundColor: c.borderLight,
        opacity: 0.8,
      },
    })
  );

  const emit = (nextYear: number, nextMonth: number, nextDay: number) => {
    const maxDay = daysInMonth(nextYear, nextMonth);
    const clampedDay = Math.min(nextDay, maxDay);
    onChange(formatIsoDate(nextYear, nextMonth, clampedDay));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.headerCell, styles.dayCol]}>День</Text>
        <Text style={[styles.headerCell, styles.monthCol]}>Месяц</Text>
        <Text style={[styles.headerCell, styles.yearCol]}>Год</Text>
      </View>
      <View style={styles.columns}>
        <VerticalCarouselColumn
          width={56}
          items={days}
          selectedIndex={dayIndex}
          onSelectIndex={(index) => emit(year, month, index + 1)}
        />
        <View style={styles.divider} />
        <VerticalCarouselColumn
          flex={1}
          items={months}
          selectedIndex={monthIndex}
          onSelectIndex={(index) => emit(year, index + 1, day)}
        />
        <View style={styles.divider} />
        <VerticalCarouselColumn
          width={72}
          items={years}
          selectedIndex={yearIndex}
          onSelectIndex={(index) => emit(Number(years[index]), month, day)}
        />
      </View>
    </View>
  );
}
