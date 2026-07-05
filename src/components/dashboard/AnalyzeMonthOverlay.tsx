import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { LUXURY_GOLD } from '../../theme/premium';
import { spacing, typography } from '../../theme/layout';

type Props = {
  visible: boolean;
  hint: string;
};

export function AnalyzeMonthOverlay({ visible, hint }: Props) {
  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      overlay: {
        flex: 1,
        backgroundColor: c.overlay,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
      },
      card: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: c.surface,
        borderRadius: radii.xl,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: c.borderLight,
        ...shadows.card,
        overflow: 'hidden',
      },
      goldLine: {
        position: 'absolute',
        top: 0,
        left: spacing.xl,
        right: spacing.xl,
        height: 2,
        backgroundColor: LUXURY_GOLD,
        opacity: 0.7,
        borderRadius: 1,
      },
      iconRing: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surfaceMuted,
        borderWidth: 1,
        borderColor: c.borderLight,
        marginBottom: spacing.md,
      },
      title: {
        ...typography.h3,
        color: c.text,
        marginBottom: spacing.xs,
      },
      hint: {
        ...typography.body,
        color: c.textMuted,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.lg,
      },
      loader: {
        marginTop: spacing.xs,
      },
    })
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.goldLine} />
          <View style={styles.iconRing}>
            <Ionicons name="sparkles-outline" size={26} color={LUXURY_GOLD} />
          </View>
          <Text style={styles.title}>Собираем разбор</Text>
          <Text style={styles.hint}>{hint}</Text>
          <ActivityIndicator style={styles.loader} size="large" color={LUXURY_GOLD} />
        </View>
      </View>
    </Modal>
  );
}
