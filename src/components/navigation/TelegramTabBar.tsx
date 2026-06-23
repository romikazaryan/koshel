import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { BottomTabBarHeightCallbackContext } from '@react-navigation/bottom-tabs';
import { useContext, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../contexts/ThemeContext';
import { hexToRgba } from '../../lib/colorUtils';
import { TabBarGlassBackground } from './TabBarGlassBackground';

export const TELEGRAM_TAB_BAR_HEIGHT = 56;
export const TELEGRAM_TAB_BAR_BOTTOM_GAP = 10;
export const TELEGRAM_TAB_BAR_HORIZONTAL_INSET = 18;

const PILL_INSET = 4;
const ICON_SIZE = 26;

type TabIconConfig = {
  active: keyof typeof Ionicons.glyphMap;
  inactive: keyof typeof Ionicons.glyphMap;
};

const TAB_ICONS: Record<string, TabIconConfig> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Finances: { active: 'wallet', inactive: 'wallet-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
};

export function getTelegramTabBarOffset(bottomInset: number) {
  return TELEGRAM_TAB_BAR_HEIGHT + TELEGRAM_TAB_BAR_BOTTOM_GAP + bottomInset;
}

export function TelegramTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const { colors, isDark } = useAppTheme();
  const [barWidth, setBarWidth] = useState(0);
  const pillIndex = useRef(new Animated.Value(state.index)).current;

  const totalHeight = getTelegramTabBarOffset(insets.bottom);

  useEffect(() => {
    onHeightChange?.(totalHeight);
  }, [onHeightChange, totalHeight]);

  const tabCount = state.routes.length;
  const tabWidth = barWidth > 0 ? barWidth / tabCount : 0;
  const pillWidth = Math.max(tabWidth - PILL_INSET * 2, 0);

  useEffect(() => {
    Animated.spring(pillIndex, {
      toValue: state.index,
      useNativeDriver: true,
      damping: 22,
      stiffness: 260,
      mass: 0.8,
    }).start();
  }, [pillIndex, state.index]);

  const pillTranslateX =
    tabWidth > 0
      ? pillIndex.interpolate({
          inputRange: state.routes.map((_, index) => index),
          outputRange: state.routes.map((_, index) => index * tabWidth + PILL_INSET),
        })
      : 0;

  const onBarLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  const barBorder = hexToRgba(isDark ? colors.accent : colors.navy, isDark ? 0.14 : 0.08);
  const pillBackground = hexToRgba(colors.accent, isDark ? 0.16 : 0.14);
  const pillBorder = hexToRgba(colors.accent, isDark ? 0.28 : 0.22);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          paddingBottom: insets.bottom + TELEGRAM_TAB_BAR_BOTTOM_GAP,
          paddingHorizontal: TELEGRAM_TAB_BAR_HORIZONTAL_INSET,
        },
      ]}
    >
      <View
        style={[
          styles.shadow,
          {
            shadowColor: colors.shadow,
            shadowOpacity: isDark ? 0.35 : 0.14,
          },
        ]}
      >
        <View style={[styles.barShell, { borderColor: barBorder }]}>
          <TabBarGlassBackground isDark={isDark} surface={colors.surface} accent={colors.accent} />

          <View style={styles.barContent} onLayout={onBarLayout}>
            {pillWidth > 0 ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pill,
                  {
                    width: pillWidth,
                    backgroundColor: pillBackground,
                    borderColor: pillBorder,
                    transform: [{ translateX: pillTranslateX }],
                  },
                ]}
              />
            ) : null}

            {state.routes.map((route, index) => {
              const focused = state.index === index;
              const { options } = descriptors[route.key];
              const label = options.title ?? route.name;
              const iconSet = TAB_ICONS[route.name] ?? TAB_ICONS.Home;
              const iconName = focused ? iconSet.active : iconSet.inactive;
              const tint = focused ? colors.tabAccent : colors.tabInactive;

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              };

              const onLongPress = () => {
                navigation.emit({
                  type: 'tabLongPress',
                  target: route.key,
                });
              };

              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="button"
                  accessibilityState={focused ? { selected: true } : {}}
                  accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                  onPress={onPress}
                  onLongPress={onLongPress}
                  style={styles.tab}
                >
                  <Ionicons name={iconName} size={ICON_SIZE} color={tint} />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.label,
                      { color: tint, fontWeight: focused ? '600' : '500' },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  shadow: {
    borderRadius: 28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  barShell: {
    height: TELEGRAM_TAB_BAR_HEIGHT,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  barContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    position: 'absolute',
    top: PILL_INSET,
    bottom: PILL_INSET,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 2,
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
});
