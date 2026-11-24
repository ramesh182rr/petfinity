import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing, touchTarget } from '@/theme';

import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

/** Two-to-four option switch (e.g. Email / Mobile). Exposed as tabs to screen readers. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.selected]}
          >
            <Text variant="label" color={selected ? 'primary' : 'textMuted'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    minHeight: touchTarget - spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  selected: { backgroundColor: colors.surface },
});
