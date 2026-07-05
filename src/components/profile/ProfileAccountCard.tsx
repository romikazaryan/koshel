import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NavyHeroBlock } from '../ui/NavyHeroBlock';
import { useAppTheme } from '../../contexts/ThemeContext';
import { heroOnDark, LUXURY_GOLD } from '../../theme/premium';
import { spacing, typography } from '../../theme/layout';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  accountLabel: string;
};

function getAccountInitial(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return 'K';
  const ch = trimmed[0];
  return ch ? ch.toUpperCase() : 'K';
}

export function ProfileAccountCard({ accountLabel }: Props) {
  const { isDark } = useAppTheme();

  const styles = useThemedStyles(({ radii, shadows }) =>
    StyleSheet.create({
      shell: {
        borderRadius: radii.xl,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)',
        overflow: 'hidden',
        ...shadows.card,
      },
      inner: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
      },
      row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
      },
      avatarRing: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1.5,
        borderColor: 'rgba(217,164,65,0.45)',
      },
      avatarLetter: {
        fontSize: 22,
        fontWeight: '800',
        color: LUXURY_GOLD,
        letterSpacing: -0.5,
      },
      body: {
        flex: 1,
        minWidth: 0,
      },
      eyebrow: {
        ...typography.overline,
        color: heroOnDark.eyebrow,
        letterSpacing: 1,
        marginBottom: 4,
      },
      account: {
        fontSize: 17,
        fontWeight: '700',
        color: heroOnDark.title,
        letterSpacing: -0.2,
        marginBottom: spacing.sm,
      },
      statusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: radii.pill,
        backgroundColor: heroOnDark.chipBg,
        borderWidth: 1,
        borderColor: heroOnDark.chipBorder,
        maxWidth: '100%',
      },
      statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: heroOnDark.subtitle,
        flexShrink: 1,
      },
    })
  );

  return (
    <NavyHeroBlock style={styles.shell}>
      <View style={styles.inner}>
        <View style={styles.row}>
          <View style={styles.avatarRing}>
            <Text style={styles.avatarLetter}>{getAccountInitial(accountLabel)}</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.eyebrow}>Ваш аккаунт</Text>
            <Text style={styles.account} numberOfLines={2}>
              {accountLabel}
            </Text>
            <View style={styles.statusChip}>
              <Ionicons name="cloud-done-outline" size={14} color={LUXURY_GOLD} />
              <Text style={styles.statusText} numberOfLines={1}>
                Данные в облаке · Supabase
              </Text>
            </View>
          </View>
        </View>
      </View>
    </NavyHeroBlock>
  );
}
