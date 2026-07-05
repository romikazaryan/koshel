import { StyleSheet, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import type { HomeStackParamList } from '../navigation/types';
import { useThemedStyles } from '../theme/useThemedStyles';
import { AddExpenseScreen } from './AddExpenseScreen';

type Props = NativeStackScreenProps<HomeStackParamList, 'IncomeMain'>;

export function IncomeScreen({ navigation, route }: Props) {
  const { month, initialTransactions } = route.params;

  const styles = useThemedStyles(() =>
    StyleSheet.create({
      safeArea: { flex: 1, backgroundColor: 'transparent' },
      body: { flex: 1 },
    })
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        backLabel="Главная"
        title="Доходы"
        subtitle="Зарплата, подработка и другие поступления"
        rightLabel="История"
        onRightPress={() =>
          navigation.navigate('TransactionHistory', {
            kind: 'income',
            month,
            initialTransactions,
          })
        }
      />
      <View style={styles.body}>
        <AddExpenseScreen lockedKind="income" embedded />
      </View>
    </SafeAreaView>
  );
}
