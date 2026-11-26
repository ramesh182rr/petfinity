import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { Text } from './Text';

type Props = {
  label: string;
  /** Optional leading icon, e.g. for quick filters. */
  icon?: ComponentProps<typeof Ionicons>['name'];
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
};

/** Pill filter / status chip. Visual height 36, touch area extended to 48 via hitSlop. */
export function Chip({ label, icon, selected = false, onPress, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      hitSlop={6}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected } : undefined}
      style={[styles.chip, selected ? styles.selected : styles.unselected]}
    >
      {icon ? (
        <Ionicons name={icon} size={16} color={selected ? colors.textOnPrimary : colors.primary} />
      ) : null}
      <Text variant="label" color={selected ? 'textOnPrimary' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  unselected: { backgroundColor: colors.surface, borderColor: colors.border },
});
