import { useCallback, useMemo, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useThemedStyles } from '../../theme/useThemedStyles';

export type CategoryCarouselOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type Props<T extends string> = {
  options: CategoryCarouselOption<T>[];
  value: T;
  onChange: (value: T) => void;
  scrollX: Animated.Value;
  pageWidth: number;
};

const PEEK_WIDTH = 56;
const SLOT_GAP = 24;
const LABEL_FONT_SIZE = 18;

function formatLabel(label: string, count?: number) {
  if (count == null) return label;
  return `${label} · ${count}`;
}

export function CapitalCategoryCarousel<T extends string>({
  options,
  value,
  onChange,
  scrollX,
  pageWidth,
}: Props<T>) {
  const [slotWidth, setSlotWidth] = useState(0);

  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      measureWrap: {
        position: 'absolute',
        opacity: 0,
        pointerEvents: 'none',
      },
      measureText: {
        fontSize: LABEL_FONT_SIZE,
        fontWeight: '700',
        letterSpacing: 0.2,
      },
      viewport: {
        overflow: 'hidden',
        alignSelf: 'center',
      },
      strip: {
        flexDirection: 'row',
        alignItems: 'center',
      },
      slot: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
      },
      glassPill: {
        position: 'absolute',
        top: 2,
        bottom: 2,
        left: 6,
        right: 6,
        borderRadius: radii.pill,
        backgroundColor: c.accentSoft,
        borderWidth: 1,
        borderColor: `${c.accent}40`,
      },
      labelText: {
        fontSize: LABEL_FONT_SIZE,
        fontWeight: '700',
        color: c.accent,
        letterSpacing: 0.2,
      },
    })
  );

  const handleMeasure = useCallback(
    (event: LayoutChangeEvent) => {
      const width = Math.ceil(event.nativeEvent.layout.width);
      if (width > 0) {
        setSlotWidth((prev) => (width > prev ? width + SLOT_GAP : prev));
      }
    },
    []
  );

  const viewportWidth = slotWidth > 0 ? slotWidth + PEEK_WIDTH * 2 : undefined;

  const translateX = useMemo(() => {
    if (options.length <= 1 || slotWidth <= 0 || pageWidth <= 0) {
      return null;
    }

    const centerOffset = (viewportWidth ?? slotWidth) / 2 - slotWidth / 2;
    const inputRange = options.map((_, index) => index * pageWidth);
    const outputRange = options.map((_, index) => centerOffset - index * slotWidth);

    return scrollX.interpolate({
      inputRange,
      outputRange,
      extrapolate: 'clamp',
    });
  }, [options, pageWidth, scrollX, slotWidth, viewportWidth]);

  if (options.length === 0) return null;

  if (options.length <= 1) {
    const only = options[0];
    return (
      <View style={styles.viewport}>
        <View style={styles.slot}>
          <View style={[styles.glassPill, { opacity: 0.82 }]} />
          <Text style={[styles.labelText, { opacity: 0.9 }]}>
            {formatLabel(only.label, only.count)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.measureWrap}>
        {options.map((option) => (
          <Text
            key={option.value}
            style={styles.measureText}
            onLayout={handleMeasure}
          >
            {formatLabel(option.label, option.count)}
          </Text>
        ))}
      </View>

      {slotWidth > 0 && viewportWidth && translateX ? (
        <View style={[styles.viewport, { width: viewportWidth }]}>
          <Animated.View style={[styles.strip, { transform: [{ translateX }] }]}>
            {options.map((option, index) => {
              const focusInput =
                pageWidth > 0
                  ? [
                      (index - 1) * pageWidth,
                      index * pageWidth,
                      (index + 1) * pageWidth,
                    ]
                  : [0, 0, 0];

              const glassOpacity =
                pageWidth > 0
                  ? scrollX.interpolate({
                      inputRange: focusInput,
                      outputRange: [0, 0.78, 0],
                      extrapolate: 'clamp',
                    })
                  : 0;

              const textOpacity =
                pageWidth > 0
                  ? scrollX.interpolate({
                      inputRange: focusInput,
                      outputRange: [0.36, 0.9, 0.36],
                      extrapolate: 'clamp',
                    })
                  : 0.9;

              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.slot, { width: slotWidth }]}
                  onPress={() => onChange(option.value)}
                  activeOpacity={0.65}
                  accessibilityRole="button"
                  accessibilityLabel={`Категория: ${option.label}`}
                >
                  <Animated.View
                    style={[styles.glassPill, { opacity: glassOpacity }]}
                    pointerEvents="none"
                  />
                  <Animated.Text
                    style={[styles.labelText, { opacity: textOpacity }]}
                    numberOfLines={1}
                  >
                    {formatLabel(option.label, option.count)}
                  </Animated.Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </View>
      ) : (
        <Text style={styles.labelText}>
          {formatLabel(options[0]?.label ?? '', options[0]?.count)}
        </Text>
      )}
    </View>
  );
}
