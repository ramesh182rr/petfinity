import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, LoadingState } from '@/components/states/StateViews';
import { Button, Card, Screen } from '@/components/ui';
import type { ListingKind } from '@/features/discovery/types';
import { RatingSummary } from '@/features/reviews/RatingSummary';
import { ReviewCard } from '@/features/reviews/ReviewCard';
import { useListingReviews } from '@/features/reviews/hooks';
import { colors, spacing } from '@/theme';

export default function ListingReviewsScreen() {
  const params = useLocalSearchParams<{ kind: string; id: string; name?: string }>();
  const kind: ListingKind = params.kind === 'vet' ? 'vet' : 'clinic';
  const list = useListingReviews(kind, params.id);

  if (list.isPending) return <LoadingState message="Loading reviews…" />;
  if (list.isError) {
    return (
      <ErrorState
        onRetry={() => void list.refetch()}
        requestId={isApiError(list.error) ? list.error.requestId : null}
      />
    );
  }
  const summary = list.data.pages[0]?.summary;
  const items = list.data.pages.flatMap((p) => p.items);
  const from = params.name ?? (kind === 'clinic' ? 'the clinic' : 'the vet');

  return (
    <Screen edges={[]} testID="listing-reviews">
      <Card>
        <RatingSummary rating={summary?.rating} count={summary?.review_count ?? 0} />
      </Card>
      {items.length ? (
        <Card style={styles.list}>
          {items.map((r, i) => (
            <View key={r.id} style={i > 0 ? styles.divider : undefined}>
              <ReviewCard review={r} replyFrom={from} />
            </View>
          ))}
        </Card>
      ) : (
        <Card>
          <EmptyState
            compact
            icon="star-outline"
            tone="peach"
            title="No reviews yet"
            message="Reviews come only from pet parents after a completed visit."
          />
        </Card>
      )}
      {list.hasNextPage ? (
        <Button
          label="Show more"
          variant="secondary"
          fullWidth
          loading={list.isFetchingNextPage}
          onPress={() => void list.fetchNextPage()}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: spacing.xs },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
