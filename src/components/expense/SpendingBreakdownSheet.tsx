import { useMemo } from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedDonutChart } from '../charts/AnimatedDonutChart';
import { BottomSheetBackdrop } from '../ui/BottomSheetBackdrop';
import { NavyHeroBlock } from '../ui/NavyHeroBlock';
import { SectionLabel } from '../ui/SectionLabel';
import { formatMoney } from '../../lib/formatMoney';
import { useSwipeDownToClose } from '../../lib/useSwipeDownToClose';
import { heroOnDark, LUXURY_GOLD } from '../../theme/premium';
import { moneyText, typography } from '../../theme/layout';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';
import type { Category } from '../../types';

type BreakdownItem = {
  category: Category;
  amount: number;
  color: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  monthLabel: string;
  items: BreakdownItem[];
};

export function SpendingBreakdownSheet({ visible, onClose, monthLabel, items }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { translateY, backdropOpacity, close, PanGestureHandler, panGestureProps } =
    useSwipeDownToClose(visible, onClose, { mode: 'header' });

  const styles = useThemedStyles(({ colors: c, radii, shadows, spacing }) =>
    StyleSheet.create({
      root: { flex: 1 },
      backdrop: { flex: 1, justifyContent: 'flex-end' },
      sheet: {
        zIndex: 1,
        maxHeight: '90%',
        backgroundColor: c.surface,
        borderTopLeftRadius: radii.xl + 4,
        borderTopRightRadius: radii.xl + 4,
        overflow: 'hidden',
        ...shadows.card,
      },
      scrollContent: {
        paddingBottom: Math.max(insets.bottom, spacing.lg),
      },
      dragHeader: {},
      handleWrap: {
        alignItems: 'center',
        paddingTop: spacing.sm,
        paddingBottom: spacing.xs,
      },
      dragHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: heroOnDark.handle,
      },
      heroInner: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.xs,
        paddingBottom: spacing.xl,
      },
      heroTop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
      },
      heroEyebrow: {
        ...typography.overline,
        color: heroOnDark.eyebrow,
        letterSpacing: 1.2,
      },
      closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: heroOnDark.closeBg,
        alignItems: 'center',
        justifyContent: 'center',
      },
      heroTitle: {
        ...typography.h1,
        color: heroOnDark.title,
        letterSpacing: -0.6,
        marginBottom: 4,
      },
      heroSubtitle: {
        ...typography.body,
        color: heroOnDark.subtitle,
        marginBottom: spacing.lg,
      },
      heroTotal: {
        fontSize: 38,
        fontWeight: '900',
        color: heroOnDark.title,
        letterSpacing: -1,
        ...moneyText,
      },
      chartWrap: {
        alignItems: 'center',
        marginTop: spacing.sm,
      },
      body: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
      },
      row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
        borderRadius: radii.lg,
        backgroundColor: c.surfaceMuted,
        borderWidth: 1,
        borderColor: c.borderLight,
      },
      rowLeader: {
        borderColor: LUXURY_GOLD,
        backgroundColor: c.surface,
      },
      rank: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: c.backgroundDeep,
      },
      rankLeader: {
        backgroundColor: 'rgba(217,164,65,0.18)',
      },
      rankText: {
        ...typography.caption,
        color: c.textMuted,
        fontWeight: '800',
      },
      rankTextLeader: { color: LUXURY_GOLD },
      rowMain: { flex: 1, minWidth: 0 },
      rowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.sm,
        marginBottom: spacing.sm,
      },
      rowLabelWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        flex: 1,
      },
      dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
      },
      rowLabel: {
        ...typography.h3,
        color: c.text,
        flexShrink: 1,
      },
      rowBadge: {
        ...typography.caption,
        color: LUXURY_GOLD,
        backgroundColor: 'rgba(217,164,65,0.14)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        overflow: 'hidden',
        fontSize: 10,
      },
      rowAmount: {
        ...typography.h3,
        color: c.text,
        ...moneyText,
      },
      barTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: c.backgroundDeep,
        overflow: 'hidden',
      },
      barFill: {
        height: '100%',
        borderRadius: 3,
      },
      rowMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 6,
      },
      rowPercent: {
        ...typography.caption,
        color: c.textMuted,
      },
      empty: {
        paddingVertical: spacing.xxl * 2,
        alignItems: 'center',
        gap: spacing.md,
      },
      emptyText: {
        ...typography.bodyLg,
        color: c.textMuted,
        textAlign: 'center',
      },
    })
  );

  const sorted = useMemo(
    () => [...items].sort((a, b) => b.amount - a.amount),
    [items]
  );

  const total = useMemo(() => sorted.reduce((sum, item) => sum + item.amount, 0), [sorted]);

  const slices = useMemo(
    () =>
      sorted.map((item) => ({
        label: item.category,
        amount: item.amount,
        color: item.color,
      })),
    [sorted]
  );

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.root} pointerEvents="box-none">
        <View style={styles.backdrop} pointerEvents="box-none">
          <BottomSheetBackdrop onPress={close} opacity={backdropOpacity} />
          <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
            <PanGestureHandler {...panGestureProps}>
              <View style={styles.dragHeader}>
                <NavyHeroBlock>
                  <View style={styles.handleWrap}>
                    <View style={styles.dragHandle} />
                  </View>
                  <View style={styles.heroInner}>
                    <View style={styles.heroTop}>
                      <Text style={styles.heroEyebrow}>{monthLabel}</Text>
                      <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={close}
                        accessibilityRole="button"
                        accessibilityLabel="Закрыть"
                      >
                        <Ionicons name="close" size={20} color={heroOnDark.title} />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.heroTitle}>Куда ушли деньги</Text>
                    <Text style={styles.heroSubtitle}>Разбивка расходов за месяц</Text>
                    <Text style={styles.heroTotal}>{formatMoney(total)}</Text>
                    {slices.length > 0 ? (
                      <View style={styles.chartWrap} pointerEvents="none">
                        <AnimatedDonutChart slices={slices} size={188} animateEntrance={false} />
                      </View>
                    ) : null}
                  </View>
                </NavyHeroBlock>
              </View>
            </PanGestureHandler>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.body}>
                {sorted.length > 0 ? <SectionLabel>По категориям</SectionLabel> : null}
                {sorted.length === 0 ? (
                  <View style={styles.empty}>
                    <Ionicons name="pie-chart-outline" size={40} color={colors.textMuted} />
                    <Text style={styles.emptyText}>За этот месяц расходов пока нет</Text>
                  </View>
                ) : (
                  sorted.map((item, index) => {
                    const percent = total > 0 ? Math.round((item.amount / total) * 100) : 0;
                    const widthPercent = Math.max(6, percent);
                    const isLeader = index === 0;
                    return (
                      <View key={item.category} style={[styles.row, isLeader && styles.rowLeader]}>
                        <View style={[styles.rank, isLeader && styles.rankLeader]}>
                          <Text style={[styles.rankText, isLeader && styles.rankTextLeader]}>
                            {index + 1}
                          </Text>
                        </View>
                        <View style={styles.rowMain}>
                          <View style={styles.rowTop}>
                            <View style={styles.rowLabelWrap}>
                              <View style={[styles.dot, { backgroundColor: item.color }]} />
                              <Text style={styles.rowLabel} numberOfLines={1}>
                                {item.category}
                              </Text>
                              {isLeader ? <Text style={styles.rowBadge}>лидер</Text> : null}
                            </View>
                            <Text style={styles.rowAmount}>{formatMoney(item.amount)}</Text>
                          </View>
                          <View style={styles.barTrack}>
                            <View
                              style={[
                                styles.barFill,
                                { width: `${widthPercent}%`, backgroundColor: item.color },
                              ]}
                            />
                          </View>
                          <View style={styles.rowMeta}>
                            <Text style={styles.rowPercent}>{percent}% от всех трат</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
