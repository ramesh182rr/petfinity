import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { IconBadge, type IconBadgeTone } from './IconBadge';
import { Text } from './Text';

/** Read-only labelled value with an icon tile (renders nothing when value is empty). */
export function InfoRow({
  icon,
  tone = 'lavender',
  label,
  value,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  tone?: IconBadgeTone;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <IconBadge name={icon} tone={tone} />
      <View style={styles.text}>
        <Text variant="caption" color="textMuted">
          {label}
        </Text>
        <Text variant="body">{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  text: { flex: 1, gap: spacing.xxs, paddingTop: 2 },
});
