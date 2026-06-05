import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { ExpensesStack } from './ExpensesStack';
import { FinancesStack } from './FinancesStack';
import { HomeStack } from './HomeStack';
import { IncomeStack } from './IncomeStack';
import { ProfileStack } from './ProfileStack';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const styles = useThemedStyles(({ colors }) =>
    StyleSheet.create({
      tabIcon: {
        fontSize: 20,
        color: colors.tabInactive,
        marginTop: 2,
      },
      tabIconFocused: {
        color: colors.tabActive,
      },
    })
  );

  return <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>{label}</Text>;
}

export function MainTabs() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, shadows: s }) =>
    StyleSheet.create({
      tabBar: {
        backgroundColor: c.tabBar,
        borderTopWidth: 0,
        paddingTop: 6,
        height: 88,
        ...s.tabBar,
      },
      tabLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 6,
      },
    })
  );

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        lazy: true,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          title: 'Главная',
          tabBarIcon: ({ focused }) => <TabIcon label="⌂" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Expenses"
        component={ExpensesStack}
        options={{
          title: 'Расходы',
          tabBarIcon: ({ focused }) => <TabIcon label="↓" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Income"
        component={IncomeStack}
        options={{
          title: 'Доход',
          tabBarIcon: ({ focused }) => <TabIcon label="↑" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Finances"
        component={FinancesStack}
        options={{
          title: 'Финансы',
          tabBarIcon: ({ focused }) => <TabIcon label="◆" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          title: 'Профиль',
          tabBarIcon: ({ focused }) => <TabIcon label="◎" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}
