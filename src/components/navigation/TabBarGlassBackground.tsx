import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View } from 'react-native';
import { hexToRgba } from '../../lib/colorUtils';

type Props = {
  isDark: boolean;
  surface: string;
  accent: string;
};

/** iOS: нативный blur + брендовый tint. Android / без модуля: полупрозрачная подложка. */
export function TabBarGlassBackground({ isDark, surface, accent }: Props) {
  const fallback = hexToRgba(surface, isDark ? 0.96 : 0.92);
  const tintOverlay = hexToRgba(surface, isDark ? 0.32 : 0.55);
  const sheen = hexToRgba(isDark ? accent : surface, isDark ? 0.06 : 0.5);
  const highlight = hexToRgba(isDark ? accent : '#FFFFFF', isDark ? 0.18 : 0.8);

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
