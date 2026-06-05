import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { koshelLogoTextStyle, koshelLogoWord } from './koshelLogoStyles';

export type KoshelLogoProps = {
  size?: number;
  color?: string;
  /** Центральный символ: «$» (финальный логотип) или «s». */
  center?: 'dollar' | 's';
  style?: StyleProp<TextStyle>;
};

export function KoshelLogo({ size = 44, color, center = 'dollar', style }: KoshelLogoProps) {
  const { colors } = useAppTheme();
  const ink = color ?? colors.accent;

  return (
    <Text style={[koshelLogoTextStyle(size), { color: ink }, style]} allowFontScaling={false}>
      {koshelLogoWord(center)}
    </Text>
  );
}
