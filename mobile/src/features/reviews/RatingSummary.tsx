import { StyleSheet, View } from 'react-native';

import { Stars, Text } from '@/components/ui';
import { spacing } from '@/theme';

/** "4.8 ★★★★★ · 12 reviews", or "No reviews yet". */
export function RatingSummary({
  rating,
  count,
}: {
  rating: number | null | undefined;
  count: number;
}) {
  if (!count || rating == null) {
    return (
      <Text variant="body" color="textMuted" testID="rating-summary">
        No reviews yet
      </Text>
    );
  }
  return (
    <View style={styles.row} testID="rating-summary">
      <Text variant="heading">{rating.toFixed(1)}</Text>
      <View style={styles.stack}>
        <Stars value={rating} size={18} />
        <Text variant="caption" color="textMuted">
          {count} {count === 1 ? 'review' : 'reviews'} from completed visits
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stack: { gap: spacing.xxs },
});
