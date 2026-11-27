import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, SectionHeader } from '@/components/ui';
import type { ListingKind } from '@/features/discovery/types';
import { colors, spacing } from '@/theme';

import { RatingSummary } from './RatingSummary';
import { ReviewCard } from './ReviewCard';
import type { PublicReview } from './types';

/** Listing page block: summary plus the newest reviews, with "See all". */
export function ReviewsSection({
  kind,
  id,
  name,
  rating,
  count,
  recent,
}: {
  kind: ListingKind;
  id: string;
  name: string;
  rating: number | null | undefined;
  count: number;
  recent: PublicReview[];
}) {
  return (
    <View style={styles.section} testID="reviews-section">
      <SectionHeader
        title="Reviews"
        actionLabel={count > recent.length ? `See all ${count}` : undefined}
        onAction={() => router.push({ pathname: '/discover/reviews', params: { kind, id, name } })}
      />
      <Card style={styles.card}>
        <RatingSummary rating={rating} count={count} />
        {recent.map((r) => (
          <View key={r.id} style={styles.divider}>
            <ReviewCard review={r} replyFrom={name} />
          </View>
        ))}
      </Card>
    </View>
  );
}

export function ratingTile(rating: number | null | undefined, count: number) {
  return count && rating != null
    ? { value: `★ ${rating.toFixed(1)}`, label: `${count} ${count === 1 ? 'review' : 'reviews'}` }
    : { value: 'New', label: 'No reviews yet' };
}

const styles = StyleSheet.create({
  section: { gap: spacing.md },
  card: { gap: spacing.xs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
