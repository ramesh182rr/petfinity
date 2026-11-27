import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, Card, IconBadge, Stars, StatusPill, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

import { reviewDate } from './ReviewCard';
import type { MyReview } from './types';

/** On a completed booking: invite a review, or show the parent's own review. */
export function MyReviewCard({
  bookingId,
  review,
  canReview,
  listingName,
}: {
  bookingId: string;
  review: MyReview | null | undefined;
  canReview: boolean;
  listingName: string;
}) {
  const open = () => router.push({ pathname: '/bookings/[id]/review', params: { id: bookingId } });
  if (!review) {
    if (!canReview) return null;
    return (
      <Card style={styles.card} testID="review-invite">
        <View style={styles.row}>
          <IconBadge name="star" tone="peach" />
          <View style={styles.flex}>
            <Text variant="bodyStrong">How was {listingName}?</Text>
            <Text variant="caption" color="textMuted">
              Your rating helps other pet parents choose with confidence.
            </Text>
          </View>
        </View>
        <Button
          label="Rate your visit"
          icon="star"
          fullWidth
          onPress={open}
          testID="review-start"
        />
      </Card>
    );
  }
  return (
    <Card style={styles.card} testID="my-review">
      <View style={styles.row}>
        <Stars value={review.rating} size={20} />
        <Text variant="caption" color="textMuted" style={styles.flex}>
          {reviewDate(review.created_at)}
          {review.edited ? ' · edited' : ''}
        </Text>
        {review.status !== 'published' ? (
          <StatusPill
            label={review.status === 'removed' ? 'Removed' : 'Hidden for now'}
            tone={review.status === 'removed' ? 'error' : 'warning'}
          />
        ) : null}
      </View>
      {review.text ? <Text variant="body">{review.text}</Text> : null}
      {review.status_note ? (
        <Text variant="caption" color="textMuted" testID="my-review-note">
          {review.status_note}
        </Text>
      ) : null}
      {review.reply ? (
        <View style={styles.reply}>
          <Text variant="label" color="primary">
            Reply from {listingName}
          </Text>
          <Text variant="caption">{review.reply.text}</Text>
        </View>
      ) : null}
      {review.can_edit ? (
        <Button
          label="Edit review"
          icon="create"
          variant="secondary"
          onPress={open}
          testID="review-edit"
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs },
  reply: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryTint,
  },
});
