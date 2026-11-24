import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, spacing, touchTarget, type ColorToken } from '@/theme';

import { Text } from './Text';

/** `inverse` and `outlineInverse` are for use on plum (primary) backgrounds. */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'outlineInverse';

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  icon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: ViewStyle;
};

const VARIANTS: Record<
  ButtonVariant,
  { background: ColorToken | null; pressed: ColorToken | null; text: ColorToken }
> = {
  primary: { background: 'primary', pressed: 'primaryPressed', text: 'textOnPrimary' },
  secondary: { background: 'primaryTint', pressed: 'primarySoft', text: 'primary' },
  tertiary: { background: null, pressed: 'primaryTint', text: 'primary' },
  inverse: { background: 'surface', pressed: 'primaryTint', text: 'primary' },
  outlineInverse: { background: null, pressed: 'primaryPressed', text: 'textOnPrimary' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityHint,
  testID,
  style,
}: Props) {
  const tokens = VARIANTS[variant];
  const inactive = disabled || loading;
  const textColor: ColorToken = disabled ? 'textDisabled' : tokens.text;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'lg' && styles.large,
        fullWidth && styles.fullWidth,
        tokens.background && { backgroundColor: colors[tokens.background] },
        variant === 'outlineInverse' && styles.outlineInverse,
        disabled && variant !== 'tertiary' && styles.disabled,
        pressed && tokens.pressed && { backgroundColor: colors[tokens.pressed] },
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          testID={testID ? `${testID}-loading` : undefined}
          color={colors[textColor]}
        />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={20} color={colors[textColor]} /> : null}
          <Text variant="bodyStrong" color={textColor} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  large: { minHeight: 56 },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  disabled: { backgroundColor: colors.backgroundAlt },
  outlineInverse: { borderWidth: 1.5, borderColor: colors.textOnPrimary },
  pressed: { transform: [{ scale: 0.98 }] },
});
