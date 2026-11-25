import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Text } from './Text';

type Tone = 'lavender' | 'sage' | 'coral' | 'peach';
const BG: Record<Tone, string> = {
  lavender: colors.primaryTint,
  sage: colors.accentSageTint,
  coral: colors.accentCoralTint,
  peach: colors.accentPeachTint,
};

/** Small value/label tile. Tiles in a row share width equally (flex: 1). */
export function StatTile({
  label,
  value,
  tone = 'lavender',
}: {
  label: string;
  value: string;
  tone?: Tone;
}) {
  return (
    <View
      style={[styles.tile, { backgroundColor: BG[tone] }]}
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text variant="subheading" numberOfLines={1} align="center">
        {value}
      </Text>
      <Text variant="caption" color="textMuted" align="center" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 72,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
});
