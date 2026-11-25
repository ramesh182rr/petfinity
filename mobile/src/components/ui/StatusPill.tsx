import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Text } from './Text';

export type PillTone = 'primary' | 'success' | 'warning' | 'error' | 'neutral' | 'onDark';

const TONES: Record<PillTone, { bg: string; fg: string; dot: string }> = {
  primary: { bg: colors.primaryTint, fg: colors.primary, dot: colors.primary },
  success: { bg: colors.successTint, fg: colors.success, dot: colors.success },
  warning: { bg: colors.warningTint, fg: colors.warning, dot: colors.warning },
  error: { bg: colors.errorTint, fg: colors.error, dot: colors.error },
  neutral: { bg: colors.backgroundAlt, fg: colors.textMuted, dot: colors.textMuted },
  onDark: { bg: 'rgba(255,255,255,0.18)', fg: colors.textOnPrimary, dot: colors.textOnPrimary },
};

export function StatusPill({
  label,
  tone = 'primary',
  testID,
}: {
  label: string;
  tone?: PillTone;
  testID?: string;
}) {
  const t = TONES[tone];
  return (
    <View
      style={[styles.pill, { backgroundColor: t.bg }]}
      testID={testID}
      accessibilityLabel={label}
    >
      <View style={[styles.dot, { backgroundColor: t.dot }]} />
      <Text variant="label" style={{ color: t.fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
