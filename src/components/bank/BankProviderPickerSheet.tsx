import { Animated, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetBackdrop } from '../ui/BottomSheetBackdrop';
import { getStatementImportBanks } from '../../types/financialConnections';
import { useSwipeDownToClose } from '../../lib/useSwipeDownToClose';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (providerId: string, providerName: string) => void;
};

const ROW_ESTIMATE = 58;
const VISIBLE_ROWS = 5;

export function BankProviderPickerSheet({ visible, onClose, onSelect }: Props) {
  const insets = useSafeAreaInsets();
  const { translateY, backdropOpacity, close, PanGestureHandler, panGestureProps, onScroll } =
    useSwipeDownToClose(visible, onClose, { mode: 'header' });
  const banks = getStatementImportBanks();
  const listMaxHeight = Math.min(banks.length, VISIBLE_ROWS) * ROW_ESTIMATE;

  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      overlay: {
        flex: 1,
        justifyContent: 'flex-end',
      },
      dim: {
        ...StyleSheet.absoluteFill,
        backgroundColor: c.overlay,
      },
      sheet: {
        backgroundColor: c.surface,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        paddingBottom: Math.max(insets.bottom, 12),
      },
      handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: c.border,
        marginTop: 10,
        marginBottom: 8,
      },
      header: {
        paddingHorizontal: 20,
        paddingBottom: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.borderLight,
      },
      title: { fontSize: 20, fontWeight: '800', color: c.text, marginBottom: 4 },
      subtitle: { fontSize: 14, lineHeight: 20, color: c.textMuted },
      list: {
        maxHeight: listMaxHeight,
        paddingHorizontal: 20,
      },
      listContent: {
        paddingTop: 4,
        paddingBottom: 4,
      },
      row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.borderLight,
      },
      rowBody: { flex: 1, paddingRight: 12 },
      rowName: { fontSize: 16, fontWeight: '600', color: c.text },
      rowHint: { fontSize: 12, color: c.textMuted, marginTop: 2, lineHeight: 16 },
      rowArrow: { fontSize: 20, color: c.textMuted },
      cancelBtn: {
        marginHorizontal: 20,
        marginTop: 8,
        borderRadius: radii.md,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: c.border,
      },
      cancelBtnText: { color: c.text, fontWeight: '600', fontSize: 15 },
    })
  );

  return (
    <Modal visible={visible} animationType="none" transparent presentationStyle="overFullScreen" onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }} pointerEvents="box-none">
      <View style={styles.overlay} pointerEvents="box-none">
        <BottomSheetBackdrop onPress={close} opacity={backdropOpacity} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <PanGestureHandler {...panGestureProps}>
            <View>
              <View style={styles.handle} />
              <View style={styles.header}>
                <Text style={styles.title}>Выберите банк</Text>
                <Text style={styles.subtitle}>CSV или PDF из приложения банка</Text>
              </View>
            </View>
          </PanGestureHandler>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={banks.length > VISIBLE_ROWS}
            bounces={banks.length > VISIBLE_ROWS}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {banks.map((bank) => (
              <TouchableOpacity
                key={bank.id}
                style={styles.row}
                onPress={() => onSelect(bank.id, bank.name)}
              >
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{bank.name}</Text>
                  <Text style={styles.rowHint} numberOfLines={1}>
                    {bank.description}
                  </Text>
                </View>
                <Text style={styles.rowArrow}>›</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.cancelBtn} onPress={close}>
            <Text style={styles.cancelBtnText}>Отмена</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}
