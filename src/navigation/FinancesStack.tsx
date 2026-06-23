import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CapitalScreen } from '../screens/CapitalScreen';
import type { FinancesStackParamList } from './types';

const Stack = createNativeStackNavigator<FinancesStackParamList>();

export function FinancesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="Capital" component={CapitalScreen} />
    </Stack.Navigator>
  );
}
