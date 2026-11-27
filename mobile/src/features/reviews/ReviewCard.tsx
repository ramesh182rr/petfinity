import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { InitialsAvatar, Stars, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

import type { PublicReview } from './types';

export function reviewDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** One public review: who, stars, when, what, and the provider's reply. */
export function ReviewCard({
  review,
  replyFrom,
  showReport = true,
  footer,
}: {
  review: PublicReview;
  replyFrom: string;
  showReport?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <View style={styles.card} testID={`review-${review.id}`}>
      <View style={styles.head}>
        <InitialsAvatar name={review.author_name} size={40} onDark={false} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{review.author_name}</Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {[review.pets, review.service_title].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={styles.right}>
          <Stars value={review.rating} />
          <Text variant="caption" color="textMuted">
            {reviewDate(review.created_at)}
            {review.edited ? ' · edited' : ''}
          </Text>
        </View>
      </View>
      {review.text ? <Text variant="body">{review.text}</Text> : null}
      {review.reply ? (
        <View style={styles.reply} testID={`reply-${review.id}`}>
          <View style={styles.replyHead}>
            <Ionicons name="chatbubble-ellipses" size={14} color={colors.primary} />
            <Text variant="label" color="primary">
              Reply from {replyFrom}
            </Text>
          </View>
          <Text variant="caption" color="text">
            {review.reply.text}
          </Text>
        </View>
      ) : null}
      {footer}
      {showReport && !review.is_mine ? (
        <Pressable
          onPress={() =>
            router.push({ pathname: '/reviews/[id]/report', params: { id: review.id } })
          }
          accessibilityRole="button"
          accessibilityLabel={`Report review by ${review.author_name}`}
          hitSlop={12}
          style={styles.report}
          testID={`report-${review.id}`}
        >
          <Ionicons name="flag-outline" size={14} color={colors.textMuted} />
          <Text variant="caption" color="textMuted">
            Report
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, paddingVertical: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: spacing.xxs },
  right: { alignItems: 'flex-end', gap: spacing.xxs },
  reply: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryTint,
  },
  replyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  report: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, alignSelf: 'flex-end' },
});
