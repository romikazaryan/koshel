import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getStatementImportBanks } from '../../types/financialConnections';
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
  const banks = getStatementImportBanks();
  const listMaxHeight = Math.min(banks.length, VISIBLE_ROWS) * ROW_ESTIMATE;

  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.45)',
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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Выберите банк</Text>
            <Text style={styles.subtitle}>CSV или PDF из приложения банка</Text>
          </View>
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={banks.length > VISIBLE_ROWS}
            bounces={banks.length > VISIBLE_ROWS}
            keyboardShouldPersistTaps="handled"
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
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Отмена</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
