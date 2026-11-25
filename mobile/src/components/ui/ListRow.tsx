import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing, touchTarget } from '@/theme';

import { IconBadge, type IconBadgeTone } from './IconBadge';
import { Text } from './Text';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  tone?: IconBadgeTone;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  testID?: string;
};

/** Menu/settings row: icon tile, title + subtitle, trailing element or chevron. */
export function ListRow({
  icon,
  tone = 'lavender',
  title,
  subtitle,
  trailing,
  onPress,
  testID,
}: Props) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <IconBadge name={icon} tone={tone} />
      <View style={styles.text}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ??
        (onPress ? <Ionicons name="chevron-forward" size={20} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget + 16,
    paddingVertical: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  text: { flex: 1, gap: spacing.xxs },
});
