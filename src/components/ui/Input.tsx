import { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '../../contexts/ThemeContext';
import { useThemedStyles } from '../../theme/useThemedStyles';

type Props = TextInputProps & {
  label?: string;
  hint?: string;
  error?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export const Input = forwardRef<TextInput, Props>(function Input(
  { label, hint, error, containerStyle, style, ...rest },
  ref
) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(({ colors: c, radii }) =>
    StyleSheet.create({
      label: {
        fontSize: 13,
        fontWeight: '700',
        color: c.textSecondary,
        marginBottom: 6,
      },
      field: {
        backgroundColor: c.surface,
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: c.border,
        paddingHorizontal: 14,
        paddingVertical: 13,
        fontSize: 16,
        fontWeight: '600',
        color: c.text,
      },
      fieldError: {
        borderColor: c.danger,
      },
      hint: {
        fontSize: 12,
        color: c.textMuted,
        marginTop: 6,
      },
      error: {
        fontSize: 12,
        color: c.danger,
        marginTop: 6,
        fontWeight: '600',
      },
    })
  );

  return (
    <View style={containerStyle}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        style={[styles.field, !!error && styles.fieldError, style]}
        {...rest}
      />
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});
