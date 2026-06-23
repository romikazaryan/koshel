import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  type ReactNode,
} from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

type Props<T extends string> = {
  pages: T[];
  pageWidth: number;
  pageHeight?: number;
  activeIndex: number;
  onPageChange: (index: number) => void;
  renderPage: (page: T, index: number) => ReactNode;
  /** Общий scrollX для синхронизации с каруселью категорий. */
  scrollX?: Animated.Value;
};

export type CapitalAssetsPagerHandle = {
  scrollToPage: (index: number, animated?: boolean) => void;
};

type PageProps = {
  index: number;
  pageWidth: number;
  pageHeight?: number;
  scrollX: Animated.Value;
  children: ReactNode;
};

function AnimatedPagerPage({ index, pageWidth, pageHeight, scrollX, children }: PageProps) {
  const inputRange = [
    (index - 1) * pageWidth,
    index * pageWidth,
    (index + 1) * pageWidth,
  ];

  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0.45, 1, 0.45],
    extrapolate: 'clamp',
  });

  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.94, 1, 0.94],
    extrapolate: 'clamp',
  });

  const translateX = scrollX.interpolate({
    inputRange,
    outputRange: [pageWidth * 0.06, 0, -pageWidth * 0.06],
    extrapolate: 'clamp',
  });

  const pageStyle =
    pageHeight && pageHeight > 0
      ? { width: pageWidth, height: pageHeight }
      : { width: pageWidth, flex: 1 };

  return (
    <View style={pageStyle}>
      <Animated.View
        style={{
          flex: 1,
          opacity,
          transform: [{ scale }, { translateX }],
        }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

function CapitalAssetsPagerInner<T extends string>(
  {
    pages,
    pageWidth,
    pageHeight,
    activeIndex,
    onPageChange,
    renderPage,
    scrollX: sharedScrollX,
  }: Props<T>,
  ref: React.Ref<CapitalAssetsPagerHandle>
) {
  const scrollRef = useRef<ScrollView>(null);
  const internalScrollX = useRef(new Animated.Value(0)).current;
  const scrollX = sharedScrollX ?? internalScrollX;
  const activeIndexRef = useRef(activeIndex);
  const reportedIndexRef = useRef(activeIndex);
  const scrolledBySwipeRef = useRef(false);
  activeIndexRef.current = activeIndex;

  useEffect(() => {
    reportedIndexRef.current = activeIndex;
  }, [activeIndex]);

  const scrollToPage = useCallback(
    (index: number, animated = true) => {
      if (pageWidth <= 0 || pages.length === 0) return;
      const clamped = Math.min(Math.max(index, 0), pages.length - 1);
      scrollRef.current?.scrollTo({ x: clamped * pageWidth, animated });
    },
    [pageWidth, pages.length]
  );

  useImperativeHandle(ref, () => ({ scrollToPage }), [scrollToPage]);

  useEffect(() => {
    if (pages.length === 0 || scrolledBySwipeRef.current) {
      scrolledBySwipeRef.current = false;
      return;
    }
    scrollToPage(activeIndex, true);
  }, [activeIndex, pages.length, scrollToPage]);

  const reportPageIndex = useCallback(
    (offsetX: number) => {
      if (pageWidth <= 0 || pages.length === 0) return;
      const index = Math.round(offsetX / pageWidth);
      const clamped = Math.min(Math.max(index, 0), pages.length - 1);
      if (clamped === reportedIndexRef.current) return;
      reportedIndexRef.current = clamped;
      scrolledBySwipeRef.current = true;
      onPageChange(clamped);
    },
    [onPageChange, pageWidth, pages.length]
  );

  useEffect(() => {
    if (pageWidth <= 0 || pages.length === 0) return;

    const listenerId = scrollX.addListener(({ value }) => {
      reportPageIndex(value);
    });

    return () => scrollX.removeListener(listenerId);
  }, [pageWidth, pages.length, reportPageIndex, scrollX]);

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) return;
    reportPageIndex(event.nativeEvent.contentOffset.x);
  };

  const handleScrollEndDrag = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) return;
    reportPageIndex(event.nativeEvent.contentOffset.x);
  };

  if (pages.length === 0) return null;

  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: false,
      })}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      onScrollEndDrag={handleScrollEndDrag}
      style={[styles.pager, pageHeight && pageHeight > 0 ? { height: pageHeight } : null]}
      contentContainerStyle={styles.pagerContent}
    >
      {pages.map((page, index) => (
        <AnimatedPagerPage
          key={page}
          index={index}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          scrollX={scrollX}
        >
          {renderPage(page, index)}
        </AnimatedPagerPage>
      ))}
    </Animated.ScrollView>
  );
}

export const CapitalAssetsPager = forwardRef(CapitalAssetsPagerInner) as <T extends string>(
  props: Props<T> & { ref?: React.Ref<CapitalAssetsPagerHandle> }
) => ReturnType<typeof CapitalAssetsPagerInner>;

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
  pagerContent: {
    alignItems: 'stretch',
  },
});
