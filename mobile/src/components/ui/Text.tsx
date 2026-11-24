import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography, type ColorToken, type TextVariant } from '@/theme';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
};

const HEADING_VARIANTS: TextVariant[] = ['display', 'title', 'heading'];

/**
 * Brand typography. Supports the system font-size setting (dynamic type),
 * capped so layouts stay usable at very large scales.
 */
export function Text({
  variant = 'body',
  color = 'text',
  align,
  style,
  accessibilityRole,
  ...rest
}: TextProps) {
  return (
    <RNText
      accessibilityRole={
        accessibilityRole ?? (HEADING_VARIANTS.includes(variant) ? 'header' : undefined)
      }
      maxFontSizeMultiplier={variant === 'display' || variant === 'title' ? 1.4 : 1.8}
      style={[typography[variant], { color: colors[color] }, align && { textAlign: align }, style]}
      {...rest}
    />
  );
}
