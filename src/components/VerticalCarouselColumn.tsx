import { useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useThemedStyles } from '../theme/useThemedStyles';

const ITEM_HEIGHT = 34;
const WHEEL_HEIGHT = 102;

type Props = {
  items: string[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  width?: number;
  flex?: number;
};

type ItemProps = {
  index: number;
  label: string;
  scrollY: Animated.Value;
  isSelected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createItemStyles>;
};

function CarouselItem({ index, label, scrollY, isSelected, onPress, styles }: ItemProps) {
  const inputRange = [
    (index - 2) * ITEM_HEIGHT,
    (index - 1) * ITEM_HEIGHT,
    index * ITEM_HEIGHT,
    (index + 1) * ITEM_HEIGHT,
    (index + 2) * ITEM_HEIGHT,
  ];

  const scale = scrollY.interpolate({
    inputRange,
    outputRange: [0.72, 0.86, 1.12, 0.86, 0.72],
    extrapolate: 'clamp',
  });

  const opacity = scrollY.interpolate({
    inputRange,
    outputRange: [0.22, 0.48, 1, 0.48, 0.22],
    extrapolate: 'clamp',
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.slot}>
      <Animated.View
        style={[
          styles.item,
          isSelected && styles.itemSelected,
          { opacity, transform: [{ scale }] },
        ]}
      >
        <Text style={[styles.label, isSelected && styles.labelSelected]} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function createItemStyles(c: { accent: string; accentSoft: string; text: string; textMuted: string }) {
  return StyleSheet.create({
    slot: {
      width: '100%',
      height: ITEM_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    item: {
      minWidth: '72%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 8,
    },
    itemSelected: {
      backgroundColor: c.accentSoft,
    },
    label: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textMuted,
    },
    labelSelected: {
      fontSize: 17,
      fontWeight: '800',
      color: c.accent,
    },
  });
}

export function VerticalCarouselColumn({
  items,
  selectedIndex,
  onSelectIndex,
  width,
  flex,
}: Props) {
  const listRef = useRef<FlatList<string>>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const isUserScrollRef = useRef(false);
  const sidePadding = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

  const layoutStyle =
    width != null ? { width } : { flex: flex ?? 1, alignSelf: 'stretch' as const };

  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      wrap: {
        height: WHEEL_HEIGHT,
        position: 'relative',
      },
      centerMark: {
        position: 'absolute',
        left: 4,
        right: 4,
        top: '50%',
        height: ITEM_HEIGHT,
        marginTop: -ITEM_HEIGHT / 2,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: c.accent,
        opacity: 0.3,
        pointerEvents: 'none',
      },
      list: {
        flexGrow: 0,
      },
    })
  );

  const itemStyles = useThemedStyles(({ colors: c }) => createItemStyles(c));

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      if (index < 0 || index >= items.length) return;
      const offset = index * ITEM_HEIGHT;
      listRef.current?.scrollToOffset({ offset, animated });
      if (!animated) {
        scrollY.setValue(offset);
      }
    },
    [items.length, scrollY]
  );

  useEffect(() => {
    if (isUserScrollRef.current) return;
    if (selectedIndex >= 0 && selectedIndex < items.length) {
      scrollToIndex(selectedIndex, false);
    }
  }, [selectedIndex, items.length, scrollToIndex]);

  const pickIndexFromOffset = (offsetY: number) => {
    const index = Math.round(offsetY / ITEM_HEIGHT);
    return Math.max(0, Math.min(index, items.length - 1));
  };

  const handleScrollEnd = (offsetY: number) => {
    const index = pickIndexFromOffset(offsetY);
    if (index !== selectedIndex) {
      isUserScrollRef.current = true;
      onSelectIndex(index);
      requestAnimationFrame(() => {
        isUserScrollRef.current = false;
      });
    }
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    handleScrollEnd(event.nativeEvent.contentOffset.y);
  };

  if (items.length === 0) return null;

  return (
    <View style={[styles.wrap, layoutStyle]}>
      <View style={styles.centerMark} />
      <Animated.FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item, index) => `${item}-${index}`}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        bounces={items.length > 3}
        contentContainerStyle={{ paddingVertical: sidePadding }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onScrollEnd}
        onScrollEndDrag={onScrollEnd}
        getItemLayout={(_, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        renderItem={({ item, index }) => (
          <CarouselItem
            index={index}
            label={item}
            scrollY={scrollY}
            isSelected={index === selectedIndex}
            onPress={() => {
              scrollToIndex(index, true);
              onSelectIndex(index);
            }}
            styles={itemStyles}
          />
        )}
      />
    </View>
  );
}
