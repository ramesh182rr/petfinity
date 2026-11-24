import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

import { useApiHealth } from './health';

/**
 * Developer-only indicator of backend connectivity. Rendered only when __DEV__,
 * so it never appears in release builds. Tap to re-check.
 */
export function ApiStatusPill() {
  const { data, isPending, isError, refetch, isFetching } = useApiHealth();

  const state = isPending || isFetching ? 'checking' : isError ? 'down' : 'up';
  const label =
    state === 'checking'
      ? 'API: checking…'
      : state === 'down'
        ? 'API: unreachable'
        : `API: connected (v${data?.version ?? '?'})`;
  const dot = state === 'up' ? colors.success : state === 'down' ? colors.error : colors.warning;

  return (
    <Pressable
      onPress={() => refetch()}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Checks the connection to the Petfinity API again"
      hitSlop={8}
      style={styles.pill}
      testID="api-status-pill"
    >
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
