import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppTourRetakeScreen } from '../screens/AppTourRetakeScreen';
import { BankConnectionsScreen } from '../screens/BankConnectionsScreen';
import { OnboardingRetakeScreen } from '../screens/OnboardingRetakeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TinvestConnectScreen } from '../screens/TinvestConnectScreen';
import type { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingRetakeScreen} />
      <Stack.Screen name="AppTour" component={AppTourRetakeScreen} />
      <Stack.Screen name="BankConnections" component={BankConnectionsScreen} />
      <Stack.Screen name="TinvestConnect" component={TinvestConnectScreen} />
    </Stack.Navigator>
  );
}
