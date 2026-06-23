import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { HomeStackParamList } from '../navigation/types';
import { useThemedStyles } from '../theme/useThemedStyles';
import { AddExpenseScreen } from './AddExpenseScreen';

type Props = NativeStackScreenProps<HomeStackParamList, 'IncomeMain'>;

export function IncomeScreen({ navigation, route }: Props) {
  const { month, initialTransactions } = route.params;

  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 4,
      },
      backText: { color: c.accentDark, fontSize: 16, fontWeight: '600' },
      historyLink: { color: c.accentDark, fontSize: 15, fontWeight: '600' },
      body: { flex: 1 },
    })
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
          <Text style={styles.backText}>← Главная</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            navigation.navigate('TransactionHistory', {
              kind: 'income',
              month,
              initialTransactions,
            })
          }
          hitSlop={8}
        >
          <Text style={styles.historyLink}>История</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.body}>
        <AddExpenseScreen lockedKind="income" />
      </View>
    </SafeAreaView>
  );
}
