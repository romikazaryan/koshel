import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';

type Props = {
  isDark: boolean;
};

/** iOS: нативный blur. Android / без модуля: полупрозрачная подложка. */
export function TabBarGlassBackground({ isDark }: Props) {
  const fallback = isDark ? 'rgba(22, 28, 42, 0.96)' : 'rgba(255, 255, 255, 0.9)';
  const tintOverlay = isDark ? 'rgba(22, 28, 42, 0.28)' : 'rgba(255, 255, 255, 0.22)';
  const sheen = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.45)';
  const highlight = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.75)';

  return (
    <>
      {Platform.OS === 'ios' ? (
        <>
          <BlurView
            intensity={isDark ? 34 : 58}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: tintOverlay }]}
          />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fallback }]} />
      )}

      <View pointerEvents="none" style={[styles.sheen, { backgroundColor: sheen }]} />
      <View pointerEvents="none" style={[styles.highlight, { backgroundColor: highlight }]} />
    </>
  );
}

const styles = StyleSheet.create({
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '52%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    borderRadius: 1,
  },
});
