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
  useWindowDimensions,
} from 'react-native';
import { formatTimelineDay } from '../lib/transactionGrouping';
import { useThemedStyles } from '../theme/useThemedStyles';

const ITEM_WIDTH = 40;
const CAROUSEL_HEIGHT = 52;

type Props = {
  dates: string[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
};

type ItemProps = {
  index: number;
  date: string;
  scrollX: Animated.Value;
  isSelected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createItemStyles>;
};

function CarouselDateItem({ index, date, scrollX, isSelected, onPress, styles }: ItemProps) {
  const { day, weekday } = formatTimelineDay(date);

  const inputRange = [
    (index - 2) * ITEM_WIDTH,
    (index - 1) * ITEM_WIDTH,
    index * ITEM_WIDTH,
    (index + 1) * ITEM_WIDTH,
    (index + 2) * ITEM_WIDTH,
  ];

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.68, 0.84, 1.14, 0.84, 0.68],
    extrapolate: 'clamp',
  });

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.28, 0.52, 1, 0.52, 0.28],
    extrapolate: 'clamp',
  });

  const translateY = scrollX.interpolate({
    inputRange,
    outputRange: [6, 3, 0, 3, 6],
    extrapolate: 'clamp',
  });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.slot}>
      <Animated.View
        style={[
          styles.item,
          isSelected && styles.itemSelected,
          { opacity, transform: [{ scale }, { translateY }] },
        ]}
      >
        <Text style={[styles.day, isSelected && styles.daySelected]}>{day}</Text>
        <Text style={[styles.weekday, isSelected && styles.weekdaySelected]}>{weekday}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

function createItemStyles(c: {
  accent: string;
  accentSoft: string;
  text: string;
  textMuted: string;
  textOnAccent: string;
  borderLight: string;
}) {
  return StyleSheet.create({
    slot: {
      width: ITEM_WIDTH,
      height: CAROUSEL_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    item: {
      width: 36,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
      borderRadius: 10,
    },
    itemSelected: {
      backgroundColor: c.accentSoft,
    },
    day: {
      fontSize: 15,
      fontWeight: '700',
      color: c.textMuted,
      lineHeight: 18,
    },
    daySelected: {
      fontSize: 17,
      fontWeight: '800',
      color: c.accent,
    },
    weekday: {
      fontSize: 9,
      fontWeight: '600',
      color: c.textMuted,
      marginTop: 1,
      opacity: 0.85,
    },
    weekdaySelected: {
      color: c.accent,
      opacity: 1,
    },
  });
}

export function DateCarouselPicker({ dates, selectedDate, onSelectDate }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<string>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const isUserScrollRef = useRef(false);

  const sidePadding = Math.max(0, (screenWidth - 40 - ITEM_WIDTH) / 2);

  const styles = useThemedStyles(({ colors: c }) =>
    StyleSheet.create({
      wrap: {
        marginBottom: 12,
        marginTop: -4,
      },
      track: {
        height: CAROUSEL_HEIGHT,
        position: 'relative',
      },
      centerMark: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        left: '50%',
        width: 38,
        marginLeft: -19,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: c.accent,
        backgroundColor: 'transparent',
        opacity: 0.35,
        pointerEvents: 'none',
      },
      list: {
        flexGrow: 0,
      },
    })
  );

  const itemStyles = useThemedStyles(({ colors: c }) => createItemStyles(c));

  const selectedIndex = selectedDate ? dates.indexOf(selectedDate) : 0;

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      if (index < 0 || index >= dates.length) return;
      const offset = index * ITEM_WIDTH;
      listRef.current?.scrollToOffset({ offset, animated });
      if (!animated) {
        scrollX.setValue(offset);
      }
    },
    [dates.length, scrollX]
  );

  useEffect(() => {
    if (isUserScrollRef.current) return;
    if (selectedIndex >= 0) {
      scrollToIndex(selectedIndex, true);
    }
  }, [selectedIndex, scrollToIndex]);

  const pickIndexFromOffset = (offsetX: number) => {
    const index = Math.round(offsetX / ITEM_WIDTH);
    return Math.max(0, Math.min(index, dates.length - 1));
  };

  const handleScrollEnd = (offsetX: number) => {
    const index = pickIndexFromOffset(offsetX);
    const nextDate = dates[index];
    if (nextDate && nextDate !== selectedDate) {
      isUserScrollRef.current = true;
      onSelectDate(nextDate);
      requestAnimationFrame(() => {
        isUserScrollRef.current = false;
      });
    }
  };

  const onMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    handleScrollEnd(event.nativeEvent.contentOffset.x);
  };

  if (dates.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={styles.centerMark} />
        <Animated.FlatList
          ref={listRef}
          data={dates}
          horizontal
          keyExtractor={(item) => item}
          style={styles.list}
          showsHorizontalScrollIndicator={false}
          snapToInterval={ITEM_WIDTH}
          decelerationRate="fast"
          bounces={dates.length > 3}
          contentContainerStyle={{ paddingHorizontal: sidePadding }}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: true,
          })}
          scrollEventThrottle={16}
          onMomentumScrollEnd={onMomentumScrollEnd}
          onScrollEndDrag={onMomentumScrollEnd}
          getItemLayout={(_, index) => ({
            length: ITEM_WIDTH,
            offset: ITEM_WIDTH * index + sidePadding,
            index,
          })}
          renderItem={({ item, index }) => (
            <CarouselDateItem
              index={index}
              date={item}
              scrollX={scrollX}
              isSelected={item === selectedDate}
              onPress={() => {
                scrollToIndex(index, true);
                onSelectDate(item);
              }}
              styles={itemStyles}
            />
          )}
        />
      </View>
    </View>
  );
}
