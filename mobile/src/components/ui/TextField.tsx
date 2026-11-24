import { useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, radius, spacing, touchTarget, typography } from '@/theme';

import { Text } from './Text';

type Props = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label: string;
  error?: string;
  hint?: string;
  /** Fixed content before the input, e.g. a "+91" country prefix. */
  prefix?: ReactNode;
  ref?: ComponentProps<typeof TextInput>['ref'];
};

/** Text input with a visible label, hint and inline validation message (doc 08). */
export function TextField({
  label,
  error,
  hint,
  prefix,
  onFocus,
  onBlur,
  testID,
  ref,
  ...inputProps
}: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.error : focused ? colors.primary : colors.borderStrong;

  return (
    <View style={styles.container}>
      <Text variant="label">{label}</Text>
      <View style={[styles.field, { borderColor }, focused && styles.focused]}>
        {prefix ? <View style={styles.prefix}>{prefix}</View> : null}
        <TextInput
          ref={ref}
          testID={testID}
          accessibilityLabel={label}
          accessibilityHint={hint}
          aria-invalid={!!error}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...inputProps}
        />
      </View>
      {error ? (
        <Text
          variant="caption"
          color="error"
          accessibilityLiveRegion="polite"
          testID={testID ? `${testID}-error` : undefined}
        >
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  field: {
    minHeight: touchTarget + 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
  },
  focused: { borderWidth: 2 },
  prefix: {
    paddingRight: spacing.sm,
    marginRight: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
});
