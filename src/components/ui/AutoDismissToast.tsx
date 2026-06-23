import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Placement = 'bottom' | 'center';

type Props = {
  message: string | null;
  onHide: () => void;
  durationMs?: number;
  placement?: Placement;
  bottomOffset?: number;
};

export function AutoDismissToast({
  message,
  onHide,
  durationMs = 1800,
  placement = 'center',
  bottomOffset = 24,
}: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const styles = useThemedStyles(({ colors, radii, shadows }) =>
    StyleSheet.create({
      wrap: {
        position: 'absolute',
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 100,
      },
      wrapCenter: {
        top: 0,
        bottom: 0,
        justifyContent: 'center',
      },
      pill: {
        backgroundColor: colors.text,
        borderRadius: radii.lg,
        paddingHorizontal: 22,
        paddingVertical: 14,
        maxWidth: '100%',
        ...shadows.soft,
      },
      text: {
        color: colors.surface,
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
      },
    })
  );

  useEffect(() => {
    if (!message) return;

    opacity.setValue(0);
    const show = Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    });

    const hideTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) onHide();
      });
    }, durationMs);

    show.start();

    return () => clearTimeout(hideTimer);
  }, [durationMs, message, onHide, opacity]);

  if (!message) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        placement === 'center' && styles.wrapCenter,
        {
          opacity,
          ...(placement === 'bottom' ? { bottom: insets.bottom + bottomOffset } : null),
        },
      ]}
    >
      <Animated.View style={styles.pill}>
        <Text style={styles.text}>{message}</Text>
      </Animated.View>
    </Animated.View>
  );
}
