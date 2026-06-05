import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  delay?: number;
  duration?: number;
  offsetY?: number;
  /** true — растянуть на весь экран (нужно для корневых экранов, не для табов). */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function FadeSlideIn({
  children,
  delay = 0,
  duration = 480,
  offsetY = 22,
  fill = false,
  style,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    }).start();
  }, [delay, duration, progress]);

  const opacity = progress;
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [offsetY, 0],
  });

  return (
    <Animated.View
      style={[fill && { flex: 1 }, style, { opacity, transform: [{ translateY }] }]}
    >
      {children}
    </Animated.View>
  );
}
