import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../screens/DashboardScreen';
import { EditTransactionScreen } from '../screens/EditTransactionScreen';
import { RecommendationsScreen } from '../screens/RecommendationsScreen';
import { TransactionHistoryScreen } from '../screens/TransactionHistoryScreen';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="TransactionHistory" component={TransactionHistoryScreen} />
      <Stack.Screen name="Recommendations" component={RecommendationsScreen} />
      <Stack.Screen name="EditTransaction" component={EditTransactionScreen} />
    </Stack.Navigator>
  );
}
