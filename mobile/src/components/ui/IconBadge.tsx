import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

export type IconBadgeTone = 'lavender' | 'sage' | 'coral' | 'peach';

const TONES: Record<IconBadgeTone, { background: string; icon: string }> = {
  lavender: { background: colors.primaryTint, icon: colors.primary },
  sage: { background: colors.accentSageTint, icon: colors.accentSageText },
  coral: { background: colors.accentCoralTint, icon: colors.accentCoralText },
  peach: { background: colors.accentPeachTint, icon: colors.accentCoralText },
};

type Props = {
  name: ComponentProps<typeof Ionicons>['name'];
  tone?: IconBadgeTone;
  size?: 'md' | 'lg';
};

/** Soft rounded-square icon tile, as in the brand moodboard. Decorative by default. */
export function IconBadge({ name, tone = 'lavender', size = 'md' }: Props) {
  const box = size === 'lg' ? 72 : 48;
  const palette = TONES[tone];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.badge,
        {
          width: box,
          height: box,
          borderRadius: size === 'lg' ? radius.xl : radius.lg,
          backgroundColor: palette.background,
        },
      ]}
    >
      <Ionicons name={name} size={size === 'lg' ? 34 : 24} color={palette.icon} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
