import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MonthRef } from '../lib/month';
import { formatMonthLabel, getTodayMonth, isMonthAfter, shiftMonth } from '../lib/month';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = {
  value: MonthRef;
  onChange: (next: MonthRef) => void;
  tone?: 'default' | 'hero' | 'ambient';
};

export function MonthSwitcher({ value, onChange, tone = 'default' }: Props) {
  const isHero = tone === 'hero';
  const isAmbient = tone === 'ambient';
  const styles = useThemedStyles(({ colors, radii, shadows }) =>
    StyleSheet.create({
      wrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: isHero
          ? 'rgba(255,255,255,0.1)'
          : isAmbient
            ? colors.surfaceMuted
            : colors.surface,
        borderRadius: isAmbient ? radii.pill : radii.lg,
        borderWidth: 1,
        borderColor: isHero
          ? 'rgba(255,255,255,0.15)'
          : isAmbient
            ? colors.borderLight
            : colors.borderLight,
        paddingVertical: isHero ? 4 : isAmbient ? 3 : 10,
        paddingHorizontal: isHero ? 4 : isAmbient ? 4 : 12,
        marginBottom: isHero || isAmbient ? 0 : 16,
        ...(isHero || isAmbient ? {} : shadows.soft),
      },
      arrow: {
        width: isHero ? 30 : isAmbient ? 28 : 44,
        height: isHero ? 30 : isAmbient ? 28 : 44,
        borderRadius: isHero ? 15 : isAmbient ? 14 : 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isHero
          ? 'rgba(255,255,255,0.12)'
          : isAmbient
            ? colors.surface
            : colors.backgroundDeep,
      },
      arrowDisabled: {
        backgroundColor: isHero
          ? 'rgba(255,255,255,0.06)'
          : isAmbient
            ? colors.borderLight
            : colors.borderLight,
      },
      arrowText: {
        fontSize: isHero ? 22 : isAmbient ? 20 : 28,
        lineHeight: isHero ? 24 : isAmbient ? 22 : 30,
        fontWeight: '600',
        color: isHero ? colors.textOnDark : colors.accentDark,
        marginTop: -2,
      },
      arrowTextDisabled: {
        color: isHero ? 'rgba(255,255,255,0.35)' : colors.textMuted,
      },
      label: {
        fontSize: isHero ? 13 : isAmbient ? 12 : 17,
        fontWeight: '700',
        color: isHero ? colors.textOnDark : colors.text,
      },
    })
  );

  const today = getTodayMonth();
  const canGoForward = !isMonthAfter(shiftMonth(value, 1), today);

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.arrow}
        onPress={() => onChange(shiftMonth(value, -1))}
        accessibilityLabel="Предыдущий месяц"
      >
        <Text style={styles.arrowText}>‹</Text>
      </TouchableOpacity>

      <Text style={styles.label}>{formatMonthLabel(value)}</Text>

      <TouchableOpacity
        style={[styles.arrow, !canGoForward && styles.arrowDisabled]}
        onPress={() => canGoForward && onChange(shiftMonth(value, 1))}
        disabled={!canGoForward}
        accessibilityLabel="Следующий месяц"
      >
        <Text style={[styles.arrowText, !canGoForward && styles.arrowTextDisabled]}>›</Text>
      </TouchableOpacity>
    </View>
  );
}
