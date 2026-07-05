import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { NavyShimmerShell } from '../ui/NavyShimmerBackground';
import { formatMoney } from '../../lib/formatMoney';
import { heroOnDark, LUXURY_GOLD } from '../../theme/premium';
import { spacing } from '../../theme/layout';
import { useThemedStyles } from '../../theme/useThemedStyles';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  eyebrow: string;
  total: number;
  hint: string;
  icon?: IconName;
  empty?: boolean;
};

export function RecurringPaymentsHero({
  eyebrow,
  total,
  hint,
  icon = 'wallet-outline',
  empty = false,
}: Props) {
  const styles = useThemedStyles(({ radii, shadows, isDark }) =>
    StyleSheet.create({
      shell: {
        borderRadius: radii.xl,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
        ...shadows.card,
      },
      inner: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
        position: 'relative',
        zIndex: 2,
      },
      row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      },
      iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
      },
      body: { flex: 1 },
      eyebrow: {
        fontSize: 10,
        fontWeight: '800',
        color: heroOnDark.eyebrow,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
      },
      value: {
        fontSize: 28,
        fontWeight: '900',
        color: heroOnDark.title,
        letterSpacing: -0.8,
        fontVariant: ['tabular-nums'],
        marginBottom: 4,
      },
      valueMuted: {
        fontSize: 20,
        fontWeight: '800',
        color: heroOnDark.subtitle,
        marginBottom: 4,
      },
      hint: {
        fontSize: 13,
        lineHeight: 18,
        color: heroOnDark.subtitle,
      },
    })
  );

  return (
    <NavyShimmerShell style={styles.shell} idPrefix="recurringHero" showGoldEdge goldEdgeInset={18}>
      <View style={styles.inner}>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <Ionicons name={icon} size={22} color={LUXURY_GOLD} />
          </View>
          <View style={styles.body}>
            <Text style={styles.eyebrow}>{eyebrow}</Text>
            {empty ? (
              <Text style={styles.valueMuted}>Пока 0 ₽</Text>
            ) : (
              <Text style={styles.value}>{formatMoney(total)}</Text>
            )}
            <Text style={styles.hint}>{hint}</Text>
          </View>
        </View>
      </View>
    </NavyShimmerShell>
  );
}
