import { forwardRef, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = ScrollViewProps & {
  /** Дополнительный отступ снизу, чтобы поле не пряталось под клавиатуру */
  keyboardBottomPadding?: number;
  /** Оборачивать в KeyboardAvoidingView (нужно для вложенных экранов) */
  avoidKeyboard?: boolean;
};

export const KeyboardAwareScrollView = forwardRef<ScrollView, Props>(function KeyboardAwareScrollView(
  {
    children,
    contentContainerStyle,
    keyboardBottomPadding = 32,
    avoidKeyboard = true,
    keyboardShouldPersistTaps = 'handled',
    keyboardDismissMode = 'interactive',
    automaticallyAdjustKeyboardInsets = true,
    style,
    ...rest
  },
  ref
) {
  const insets = useSafeAreaInsets();

  const mergedContentStyle = useMemo(
    () => [
      { paddingBottom: Math.max(insets.bottom, 16) + keyboardBottomPadding },
      contentContainerStyle,
    ],
    [contentContainerStyle, insets.bottom, keyboardBottomPadding]
  );

  const scrollView = (
    <ScrollView
      ref={ref}
      style={[styles.flex, style]}
      contentContainerStyle={mergedContentStyle}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={keyboardDismissMode}
      automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
      {...rest}
    >
      {children}
    </ScrollView>
  );

  if (!avoidKeyboard) {
    return scrollView;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {scrollView}
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
