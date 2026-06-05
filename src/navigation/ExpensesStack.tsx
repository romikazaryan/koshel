import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ExpensesHubScreen } from '../screens/ExpensesHubScreen';
import type { ExpensesStackParamList } from './types';

const Stack = createNativeStackNavigator<ExpensesStackParamList>();

export function ExpensesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ExpensesHub" component={ExpensesHubScreen} />
    </Stack.Navigator>
  );
}
