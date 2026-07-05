import { StyleSheet, View, type ViewStyle } from 'react-native';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { spacing } from '../../theme/layout';
import { LUXURY_GOLD } from '../../theme/premium';

type Props = {
  current: number;
  total: number;
  style?: ViewStyle;
};

export function OnboardingProgressBar({ current, total, style }: Props) {
  const progress = total > 0 ? Math.min(1, current / total) : 0;

  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      track: {
        height: 4,
        borderRadius: radii.pill,
        backgroundColor: c.borderLight,
        overflow: 'hidden',
      },
      fill: {
        height: '100%',
        borderRadius: radii.pill,
        backgroundColor: LUXURY_GOLD,
        width: `${Math.round(progress * 100)}%`,
      },
    })
  );

  return (
    <View style={[styles.track, style]}>
      <View style={styles.fill} />
    </View>
  );
}
