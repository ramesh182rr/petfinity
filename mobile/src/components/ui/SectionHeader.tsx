import { Pressable, StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Text } from './Text';

type Props = { title: string; actionLabel?: string; onAction?: () => void };

/** Section title with an optional right-aligned text action ("See all"). */
export function SectionHeader({ title, actionLabel, onAction }: Props) {
  return (
    <View style={styles.row}>
      <Text variant="heading">{title}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text variant="label" color="primary">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
});
