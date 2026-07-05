import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { NavyShimmerShell } from './NavyShimmerBackground';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
};

/** Navy hero-панель с переливающимся градиентом и золотой кромкой. */
export function NavyHeroBlock({ children, style }: Props) {
  return (
    <NavyShimmerShell style={style} showGoldEdge goldEdgeInset={20}>
      <View style={styles.content}>{children}</View>
    </NavyShimmerShell>
  );
}

const styles = StyleSheet.create({
  content: {
    position: 'relative',
    zIndex: 2,
  },
});
