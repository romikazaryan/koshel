import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerGestureEvent,
  type PanGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';

type Options = {
  distanceThreshold?: number;
  velocityThreshold?: number;
  fractionThreshold?: number;
  flickMinDistance?: number;
  autoCloseFraction?: number;
  mode?: 'header' | 'scrollable';
};

const DEFAULTS = {
  distanceThreshold: 128,
  velocityThreshold: 1050,
  fractionThreshold: 0.22,
  flickMinDistance: 64,
  autoCloseFraction: 0.48,
};

function releaseVelocity(velocityY: number, peakVelocityY: number) {
  return Math.max(velocityY, peakVelocityY, 0);
}

function shouldDismiss(
  draggedTo: number,
  velocityY: number,
  peakVelocityY: number,
  screenHeight: number,
  {
    distanceThreshold,
    velocityThreshold,
    fractionThreshold,
    flickMinDistance,
  }: Required<
    Pick<
      Options,
      'distanceThreshold' | 'velocityThreshold' | 'fractionThreshold' | 'flickMinDistance'
    >
  >
) {
  if (draggedTo >= distanceThreshold) return true;
  if (draggedTo >= screenHeight * fractionThreshold) return true;

  const speed = releaseVelocity(velocityY, peakVelocityY);
  if (draggedTo < flickMinDistance) return false;
  if (speed >= velocityThreshold) return true;

  if (speed >= velocityThreshold * 0.92) {
    const projected = draggedTo + speed * 0.1;
    if (projected >= screenHeight * fractionThreshold) return true;
  }

  return false;
}

/**
 * Жест «потянуть вниз, чтобы закрыть» для нижних модальных окон.
 *
 * sheetY — позиция открытия/закрытия; dragY — смещение пальца.
 * Пружина при отпускании анимирует только dragY → 0.
 */
export function useSwipeDownToClose(
  visible: boolean,
  onClose: () => void,
  options: Options = {}
) {
  const {
    distanceThreshold = DEFAULTS.distanceThreshold,
    velocityThreshold = DEFAULTS.velocityThreshold,
    fractionThreshold = DEFAULTS.fractionThreshold,
    flickMinDistance = DEFAULTS.flickMinDistance,
    autoCloseFraction = DEFAULTS.autoCloseFraction,
    mode = 'scrollable',
  } = options;
  const height = Dimensions.get('window').height;
  const sheetY = useRef(new Animated.Value(height)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const translateY = useMemo(() => Animated.add(sheetY, dragY), [dragY, sheetY]);
  const scrollOffset = useRef(0);
  const peakVelocityY = useRef(0);
  const peakDragY = useRef(0);
  const isClosing = useRef(false);

  useEffect(() => {
    if (visible) {
      isClosing.current = false;
      peakDragY.current = 0;
      peakVelocityY.current = 0;
      dragY.setValue(0);
      sheetY.setValue(height);
      Animated.spring(sheetY, {
        toValue: 0,
        useNativeDriver: false,
        bounciness: 4,
        speed: 12,
      }).start();
    }
  }, [visible, dragY, height, sheetY]);

  const close = useCallback(() => {
    if (isClosing.current) return;
    isClosing.current = true;

    dragY.stopAnimation();
    sheetY.stopAnimation((sheetValue) => {
      dragY.stopAnimation((dragValue) => {
        const total = sheetValue + dragValue;
        dragY.setValue(0);
        sheetY.setValue(total);
        Animated.timing(sheetY, {
          toValue: height,
          duration: 200,
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished) onClose();
        });
      });
    });
  }, [dragY, height, onClose, sheetY]);

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, height],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = e.nativeEvent.contentOffset.y;
  }, []);

  const isDragBlocked = useCallback(() => {
    return mode === 'scrollable' && scrollOffset.current > 0;
  }, [mode]);

  const maybeAutoClose = useCallback(
    (dragOffset: number) => {
      if (isClosing.current) return;
      if (dragOffset >= height * autoCloseFraction) {
        close();
      }
    },
    [autoCloseFraction, close, height]
  );

  const snapBack = useCallback(
    (releaseVelocityY = 0) => {
      dragY.stopAnimation((current) => {
        dragY.setValue(current);
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: false,
          bounciness: 9,
          speed: 14,
          velocity: releaseVelocityY > 0 ? -releaseVelocityY / 800 : 0,
        }).start();
      });
    },
    [dragY]
  );

  const finishDrag = useCallback(
    (velocityY: number) => {
      if (isClosing.current) return;

      dragY.stopAnimation((draggedTo) => {
        const offset = Math.max(draggedTo, peakDragY.current);
        const peakV = peakVelocityY.current;
        dragY.setValue(offset);
        peakDragY.current = 0;
        peakVelocityY.current = 0;

        if (
          shouldDismiss(offset, velocityY, peakV, height, {
            distanceThreshold,
            velocityThreshold,
            fractionThreshold,
            flickMinDistance,
          })
        ) {
          close();
          return;
        }

        snapBack(velocityY);
      });
    },
    [
      close,
      distanceThreshold,
      dragY,
      flickMinDistance,
      fractionThreshold,
      height,
      snapBack,
      velocityThreshold,
    ]
  );

  const onGestureEvent = useCallback(
    (event: PanGestureHandlerGestureEvent) => {
      if (isClosing.current || isDragBlocked()) return;

      const { translationY, velocityY } = event.nativeEvent;
      if (velocityY > peakVelocityY.current) {
        peakVelocityY.current = velocityY;
      }

      const next = Math.max(0, translationY);
      if (next > peakDragY.current) {
        peakDragY.current = next;
      }
      dragY.setValue(next);
      maybeAutoClose(next);
    },
    [dragY, isDragBlocked, maybeAutoClose]
  );

  const onHandlerStateChange = useCallback(
    (event: PanGestureHandlerStateChangeEvent) => {
      if (isClosing.current) return;

      const { state, oldState, velocityY } = event.nativeEvent;

      if (state === State.BEGAN) {
        peakVelocityY.current = 0;
        peakDragY.current = 0;
        dragY.stopAnimation();
        dragY.setValue(0);
        return;
      }

      if (
        oldState === State.ACTIVE &&
        (state === State.END || state === State.CANCELLED || state === State.FAILED)
      ) {
        finishDrag(velocityY);
      }
    },
    [finishDrag]
  );

  const panGestureProps = {
    onGestureEvent,
    onHandlerStateChange,
    activeOffsetY: 16,
    failOffsetX: [-24, 24] as [number, number],
  };

  return {
    translateY,
    backdropOpacity,
    close,
    onScroll,
    PanGestureHandler,
    panGestureProps,
  };
}
