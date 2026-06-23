import {
  Animated,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';

type Props = {
  onPress: () => void;
  opacity: Animated.AnimatedInterpolation<number>;
  style?: StyleProp<ViewStyle>;
};

/** Затемнение за шитом: тап по области вне окна закрывает его. */
export function BottomSheetBackdrop({ onPress, opacity, style }: Props) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      style={[StyleSheet.absoluteFill, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Закрыть"
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity }]}
      />
    </Pressable>
  );
}
