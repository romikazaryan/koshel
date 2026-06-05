import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { IncomeScreen } from '../screens/IncomeScreen';
import type { IncomeStackParamList } from './types';

const Stack = createNativeStackNavigator<IncomeStackParamList>();

export function IncomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="IncomeMain" component={IncomeScreen} />
    </Stack.Navigator>
  );
}
