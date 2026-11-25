/**
 * Petfinity colour system — decision 0002 (moodboard-aligned palette).
 *
 * `palette` holds raw brand values. Screens and components must use the
 * semantic `colors` below, never raw hex values, so the brand can evolve in one place.
 *
 * Accessibility: decorative fills (sage, coral, peach, lavender) are NOT for text.
 * Text on them uses `ink`; coloured text uses the `*Deep` variants. Ratios are
 * enforced by __tests__/theme-contrast-test.ts.
 */
export const palette = {
  plum700: '#4F1F5C',
  plum600: '#6A2C7A',
  plum300: '#BF97D5',
  plum100: '#F1E7F7',
  plum50: '#F8F2FB',

  sage600: '#56663A',
  sage400: '#8F9D61',
  sage100: '#EAEFDC',

  coral600: '#A8432A',
  coral400: '#F88F73',
  coral100: '#FEE6DE',

  peach400: '#F9BF8F',
  peach100: '#FDEEDF',

  cream: '#FFF8F0',
  creamDeep: '#FBF0E4',
  white: '#FFFFFF',

  ink900: '#2A2233',
  ink600: '#6B6377',
  ink400: '#9A8FA3',
  line: '#EADFD3',

  green700: '#217A54',
  green100: '#E2F2EA',
  amber700: '#A35F12',
  amber100: '#FCEFD9',
  red700: '#C44747',
  red100: '#FBE5E5',
} as const;

export const colors = {
  background: palette.cream,
  backgroundAlt: palette.creamDeep,
  surface: palette.white,
  surfaceTint: palette.plum50,
  border: palette.line,
  /** Borders of interactive inputs must meet 3:1 against their surface. */
  borderStrong: palette.ink400,

  text: palette.ink900,
  textMuted: palette.ink600,
  textOnPrimary: palette.white,
  textDisabled: palette.ink400,
  link: palette.plum600,

  primary: palette.plum600,
  primaryPressed: palette.plum700,
  primarySoft: palette.plum300,
  primaryTint: palette.plum100,

  accentSage: palette.sage400,
  accentSageText: palette.sage600,
  accentSageTint: palette.sage100,
  accentCoral: palette.coral400,
  accentCoralText: palette.coral600,
  accentCoralTint: palette.coral100,
  accentPeach: palette.peach400,
  accentPeachTint: palette.peach100,

  success: palette.green700,
  successTint: palette.green100,
  warning: palette.amber700,
  warningTint: palette.amber100,
  error: palette.red700,
  errorTint: palette.red100,

  focusRing: palette.plum600,
  shadow: palette.ink900,
} as const;

export type ColorToken = keyof typeof colors;

/** Gradient stops (top-left → bottom-right). Text on `primary`/`dusk` uses textOnPrimary. */
export const gradients = {
  primary: ['#7B3A90', '#5A2468', '#3F1A4A'],
  dusk: ['#6A2C7A', '#874277', '#9A4F78'],
  warm: ['#FFF8F0', '#FDEEDF'],
  lavender: ['#F8F2FB', '#EFE4F7'],
  sage: ['#F4F7EC', '#E3EAD2'],
  coral: ['#FFF3EE', '#FDDCD1'],
} as const satisfies Record<string, readonly [string, string, ...string[]]>;

export type GradientToken = keyof typeof gradients;
