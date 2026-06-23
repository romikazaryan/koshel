import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getTelegramTabBarOffset,
  TelegramTabBar,
} from '../components/navigation/TelegramTabBar';
import { FinancesStack } from './FinancesStack';
import { HomeStack } from './HomeStack';
import { ProfileStack } from './ProfileStack';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const insets = useSafeAreaInsets();
  const sceneBottomPadding = getTelegramTabBarOffset(insets.bottom);

  return (
    <Tab.Navigator
      tabBar={(props) => <TelegramTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
        sceneStyle: {
          backgroundColor: 'transparent',
          paddingBottom: sceneBottomPadding,
        },
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          elevation: 0,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{ title: 'Главная' }}
      />
      <Tab.Screen
        name="Finances"
        component={FinancesStack}
        options={{ title: 'Финансы' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ title: 'Профиль' }}
      />
    </Tab.Navigator>
  );
}
