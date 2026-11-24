import { colors, contrastRatio } from '@/theme';

/** WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large text and UI component boundaries. */
const TEXT_PAIRS: [string, keyof typeof colors, keyof typeof colors][] = [
  ['body text on background', 'text', 'background'],
  ['body text on surface', 'text', 'surface'],
  ['muted text on background', 'textMuted', 'background'],
  ['muted text on surface', 'textMuted', 'surface'],
  ['primary text/link on background', 'primary', 'background'],
  ['primary text on primary tint', 'primary', 'primaryTint'],
  ['text on primary (buttons, hero)', 'textOnPrimary', 'primary'],
  ['text on pressed primary', 'textOnPrimary', 'primaryPressed'],
  ['sage text on background', 'accentSageText', 'background'],
  ['sage text on sage tint', 'accentSageText', 'accentSageTint'],
  ['coral text on background', 'accentCoralText', 'background'],
  ['coral text on coral tint', 'accentCoralText', 'accentCoralTint'],
  ['success on background', 'success', 'background'],
  ['warning on background', 'warning', 'background'],
  ['error on background', 'error', 'background'],
  ['error on surface', 'error', 'surface'],
];

const UI_PAIRS: [string, keyof typeof colors, keyof typeof colors][] = [
  ['input border on surface', 'borderStrong', 'surface'],
  ['focus ring on background', 'focusRing', 'background'],
];

describe('colour contrast (WCAG AA)', () => {
  it.each(TEXT_PAIRS)('%s ≥ 4.5:1', (_name, fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI_PAIRS)('%s ≥ 3:1', (_name, fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(3);
  });

  it('computes known reference ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('rejects malformed colours', () => {
    expect(() => contrastRatio('purple', '#FFFFFF')).toThrow('#RRGGBB');
  });
});
