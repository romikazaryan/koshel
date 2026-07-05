import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ComponentProps } from 'react';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { spacing, typography } from '../../theme/layout';
import { LUXURY_GOLD } from '../../theme/premium';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  icon: IconName;
  title: string;
  hint: string;
  onPress: () => void;
};

export function ProfileMenuRow({ icon, title, hint, onPress }: Props) {
  const styles = useThemedStyles(({ colors: c, radii, shadows, cardBase }) =>
    StyleSheet.create({
      card: {
        ...cardBase,
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderRadius: radii.xl,
        borderWidth: 1,
        borderColor: c.borderLight,
        ...shadows.soft,
      },
      iconWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceMuted,
        marginRight: spacing.md,
      },
      body: { flex: 1, paddingRight: spacing.sm },
      title: { ...typography.h3, fontSize: 17, marginBottom: 4 },
      hint: { ...typography.meta, color: c.textMuted, lineHeight: 18 },
      arrow: { fontSize: 22, color: c.accentDark, fontWeight: '600' },
    })
  );

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={22} color={LUXURY_GOLD} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </TouchableOpacity>
  );
}
