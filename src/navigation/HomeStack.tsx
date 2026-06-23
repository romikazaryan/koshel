import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BankStatementImportProvider } from '../contexts/BankStatementImportContext';
import { DashboardScreen } from '../screens/DashboardScreen';
import { EditTransactionScreen } from '../screens/EditTransactionScreen';
import { OperationsHubScreen } from '../screens/OperationsHubScreen';
import { IncomeScreen } from '../screens/IncomeScreen';
import { RecommendationsScreen } from '../screens/RecommendationsScreen';
import { TransactionHistoryScreen } from '../screens/TransactionHistoryScreen';
import { StatementImportsScreen } from '../screens/StatementImportsScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <BankStatementImportProvider>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="OperationsHub" component={OperationsHubScreen} />
        <Stack.Screen name="IncomeMain" component={IncomeScreen} />
        <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
        <Stack.Screen name="Recommendations" component={RecommendationsScreen} />
        <Stack.Screen name="EditTransaction" component={EditTransactionScreen} />
        <Stack.Screen name="StatementImports" component={StatementImportsScreen} />
      </Stack.Navigator>
    </BankStatementImportProvider>
  );
}
