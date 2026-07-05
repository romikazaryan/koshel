import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../contexts/ThemeContext';
import { NavyShimmerPressable } from '../ui/NavyShimmerBackground';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { spacing } from '../../theme/layout';

type Props = {
  ratesHint?: string | null;
  isRefreshingRates: boolean;
  onRefreshRates: () => void;
  onAddAsset: () => void;
  showRefresh: boolean;
};

export function CapitalScreenToolbar({
  ratesHint,
  isRefreshingRates,
  onRefreshRates,
  onAddAsset,
  showRefresh,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, shadows }) =>
    StyleSheet.create({
      row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: spacing.xs,
        paddingBottom: spacing.md,
        gap: spacing.md,
      },
      brandCol: { flex: 1 },
      brand: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 2.4,
        textTransform: 'lowercase',
        color: c.textMuted,
      },
      hint: {
        fontSize: 13,
        fontWeight: '500',
        color: c.textMuted,
        marginTop: 6,
        letterSpacing: -0.1,
      },
      actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      },
      iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.borderLight,
        ...shadows.soft,
      },
      iconButtonDisabled: { opacity: 0.5 },
      addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        ...shadows.soft,
      },
    })
  );

  return (
    <View style={styles.row}>
      <View style={styles.brandCol}>
        <Text style={styles.brand}>finances</Text>
        {ratesHint ? (
          <Text style={styles.hint} numberOfLines={1}>
            {ratesHint}
          </Text>
        ) : null}
      </View>

      <View style={styles.actions}>
        {showRefresh ? (
          <TouchableOpacity
            style={[styles.iconButton, isRefreshingRates && styles.iconButtonDisabled]}
            onPress={onRefreshRates}
            disabled={isRefreshingRates}
            accessibilityLabel="Обновить курсы"
          >
            {isRefreshingRates ? (
              <ActivityIndicator size="small" color={colors.textMuted} />
            ) : (
              <Ionicons name="refresh-outline" size={20} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        ) : null}
        <NavyShimmerPressable
          style={styles.addButton}
          contentStyle={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          onPress={onAddAsset}
          glow="compact"
          accessibilityLabel="Добавить актив"
        >
          <Ionicons name="add" size={24} color="#fff" />
        </NavyShimmerPressable>
      </View>
    </View>
  );
}
