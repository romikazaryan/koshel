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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedDonutChart } from '../charts/AnimatedDonutChart';
import { BottomSheetBackdrop } from '../ui/BottomSheetBackdrop';
import { useSwipeDownToClose } from '../../lib/useSwipeDownToClose';
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
  const { translateY, backdropOpacity, close, PanGestureHandler, panGestureProps } =
    useSwipeDownToClose(visible, onClose, { mode: 'header' });

  const styles = useThemedStyles(({ colors: c, radii, shadows }) =>
    StyleSheet.create({
      root: {
        flex: 1,
      },
      backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
      },
      sheet: {
        zIndex: 1,
        maxHeight: '88%',
        backgroundColor: c.surface,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        overflow: 'hidden',
        ...shadows.card,
      },
      scrollContent: {
        paddingBottom: Math.max(insets.bottom, 16),
      },
      dragHeader: {
        backgroundColor: c.surface,
      },
      handleWrap: {
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 6,
      },
      bodyTitleWrap: {
        paddingHorizontal: 20,
        paddingTop: 18,
        paddingBottom: 4,
      },
      dragHandle: {
        width: 44,
        height: 5,
        borderRadius: 3,
        backgroundColor: 'rgba(255,255,255,0.5)',
      },
      hero: {
        backgroundColor: c.navy,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 20,
      },
      heroTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
      },
      heroEyebrow: {
        fontSize: 11,
        fontWeight: '700',
        color: c.textOnDarkMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
      },
      closeBtn: {
        position: 'absolute',
        top: 16,
        right: 20,
        zIndex: 2,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
      },
      closeText: {
        fontSize: 18,
        lineHeight: 20,
        color: c.textOnDark,
        fontWeight: '600',
      },
      heroTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: c.textOnDark,
        marginBottom: 4,
      },
      heroSubtitle: {
        fontSize: 14,
        color: c.textOnDarkMuted,
        marginBottom: 16,
      },
      heroTotal: {
        fontSize: 36,
        fontWeight: '900',
        color: c.textOnDark,
        letterSpacing: -0.5,
      },
      chartWrap: {
        alignItems: 'center',
        marginTop: 4,
      },
      body: {
        paddingHorizontal: 20,
        paddingTop: 6,
        paddingBottom: 8,
      },
      bodyTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: c.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
        marginBottom: 14,
      },
      row: {
        marginBottom: 12,
        borderRadius: radii.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: c.borderLight,
        backgroundColor: c.surfaceMuted,
      },
      rowTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 4,
        zIndex: 1,
      },
      rowLabelWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
      },
      dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
      },
      rowLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: c.text,
        flexShrink: 1,
      },
      rowBadge: {
        fontSize: 10,
        fontWeight: '800',
        color: c.accentDark,
        backgroundColor: c.primarySoft,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: radii.pill,
        overflow: 'hidden',
      },
      rowAmount: {
        fontSize: 15,
        fontWeight: '800',
        color: c.text,
      },
      rowBarTrack: {
        height: 36,
        backgroundColor: c.backgroundDeep,
        justifyContent: 'center',
      },
      rowBarFill: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        opacity: 0.35,
      },
      rowPercent: {
        paddingHorizontal: 12,
        paddingBottom: 8,
        fontSize: 12,
        fontWeight: '600',
        color: c.textMuted,
      },
      empty: {
        paddingVertical: 28,
        alignItems: 'center',
      },
      emptyText: {
        fontSize: 15,
        color: c.textMuted,
        textAlign: 'center',
        lineHeight: 22,
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

  const maxAmount = sorted[0]?.amount ?? 1;

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
                <View style={styles.hero}>
                  <View style={styles.handleWrap}>
                    <View style={styles.dragHandle} />
                  </View>
                  <View style={styles.heroTop}>
                    <Text style={styles.heroEyebrow}>{monthLabel}</Text>
                    <TouchableOpacity
                      style={styles.closeBtn}
                      onPress={close}
                      accessibilityRole="button"
                      accessibilityLabel="Закрыть"
                    >
                      <Text style={styles.closeText}>×</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.heroTitle}>Куда ушли деньги</Text>
                  <Text style={styles.heroSubtitle}>Разбивка расходов за месяц</Text>
                  <Text style={styles.heroTotal}>₽{total.toLocaleString('ru-RU')}</Text>
                  {slices.length > 0 ? (
                    <View style={styles.chartWrap} pointerEvents="none">
                      <AnimatedDonutChart slices={slices} size={200} animateEntrance={false} />
                    </View>
                  ) : null}
                </View>
                {sorted.length > 0 ? (
                  <View style={styles.bodyTitleWrap}>
                    <Text style={styles.bodyTitle}>По категориям</Text>
                  </View>
                ) : null}
              </View>
            </PanGestureHandler>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
              bounces
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.body}>
                {sorted.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>За этот месяц расходов пока нет</Text>
                  </View>
                ) : (
                  <>
                    {sorted.map((item, index) => {
                      const percent = total > 0 ? Math.round((item.amount / total) * 100) : 0;
                      const widthPercent = Math.max(8, Math.round((item.amount / maxAmount) * 100));
                      return (
                        <View key={item.category} style={styles.row}>
                          <View style={styles.rowTop}>
                            <View style={styles.rowLabelWrap}>
                              <View style={[styles.dot, { backgroundColor: item.color }]} />
                              <Text style={styles.rowLabel} numberOfLines={1}>
                                {item.category}
                              </Text>
                              {index === 0 ? <Text style={styles.rowBadge}>лидер</Text> : null}
                            </View>
                            <Text style={styles.rowAmount}>
                              ₽{item.amount.toLocaleString('ru-RU')}
                            </Text>
                          </View>
                          <View style={styles.rowBarTrack}>
                            <View
                              style={[
                                styles.rowBarFill,
                                { width: `${widthPercent}%`, backgroundColor: item.color },
                              ]}
                            />
                          </View>
                          <Text style={styles.rowPercent}>{percent}% от всех трат</Text>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
