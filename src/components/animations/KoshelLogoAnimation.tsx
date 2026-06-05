import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { LOGO_SIZE, koshelLogoTextStyle } from '../brand/koshelLogoStyles';

export function KoshelLogoAnimation() {
  const { colors } = useAppTheme();

  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordScale = useRef(new Animated.Value(0.92)).current;
  const sOpacity = useRef(new Animated.Value(1)).current;
  const dollarOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const wordIn = Animated.parallel([
      Animated.timing(wordOpacity, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(wordScale, {
        toValue: 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }),
    ]);

    const morphToDollar = Animated.parallel([
      Animated.timing(sOpacity, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }),
      Animated.timing(dollarOpacity, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }),
    ]);

    const sequence = Animated.sequence([wordIn, Animated.delay(400), morphToDollar]);
    sequence.start();

    return () => sequence.stop();
  }, [dollarOpacity, sOpacity, wordOpacity, wordScale]);

  const wordStyle = [koshelLogoTextStyle(LOGO_SIZE.splash), { color: colors.accent }];

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: wordOpacity,
          transform: [{ scale: wordScale }],
        },
      ]}
    >
      <Animated.Text style={[wordStyle, { opacity: sOpacity }]} allowFontScaling={false}>
        koshel
      </Animated.Text>
      <Animated.Text
        style={[wordStyle, styles.dollarWord, { opacity: dollarOpacity }]}
        allowFontScaling={false}
      >
        ko$hel
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: LOGO_SIZE.splash + 12,
  },
  dollarWord: {
    position: 'absolute',
  },
});
