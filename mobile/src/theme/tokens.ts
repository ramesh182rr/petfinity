import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import { colors } from './colors';

/** 4-point spacing scale. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Rounded, friendly shapes (doc 08: 16–24px cards). */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 28,
  pill: 999,
} as const;

/** Minimum touch target (Android 48dp; iOS 44pt). */
export const touchTarget = 48;

/** Font family names, registered in app/_layout.tsx via useFonts. */
export const fonts = {
  displayBold: 'Poppins_700Bold',
  displaySemiBold: 'Poppins_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
} as const;

export type TextVariant =
  | 'hero'
  | 'display'
  | 'title'
  | 'heading'
  | 'subheading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'eyebrow';

export const typography: Record<TextVariant, TextStyle> = {
  hero: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 42, letterSpacing: -0.5 },
  display: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 38, letterSpacing: -0.3 },
  title: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32 },
  heading: { fontFamily: fonts.displaySemiBold, fontSize: 20, lineHeight: 28 },
  subheading: { fontFamily: fonts.displaySemiBold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 16, lineHeight: 24 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  eyebrow: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
};

/** Restrained elevation (doc 08). */
export const elevation: Record<'none' | 'card' | 'raised', ViewStyle> = {
  none: {},
  card: Platform.select<ViewStyle>({
    android: { elevation: 2 },
    default: {
      shadowColor: colors.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
  }),
  raised: Platform.select<ViewStyle>({
    android: { elevation: 6 },
    default: {
      shadowColor: colors.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
  }),
};
