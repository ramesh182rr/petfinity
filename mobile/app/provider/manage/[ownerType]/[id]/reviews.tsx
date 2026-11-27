import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, LoadingState } from '@/components/states/StateViews';
import { Button, Card, HeroScreen, StatusPill, Text, TextField } from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import type { OwnerType } from '@/features/catalog/types';
import { HeroStats } from '@/features/discovery/DetailParts';
import { ReviewCard } from '@/features/reviews/ReviewCard';
import { useProviderReviews, useReply } from '@/features/reviews/hooks';
import type { ProviderReview } from '@/features/reviews/types';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, spacing } from '@/theme';

function ReplyBox({ review }: { review: ProviderReview }) {
  const reply = useReply(review.id);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(review.reply?.text ?? '');
  if (!review.can_reply) {
    return (
      <View style={styles.pending}>
        <StatusPill label="Hidden while Petfinity checks it" tone="warning" />
      </View>
    );
  }
  if (!open) {
    return (
      <Button
        label={review.reply ? 'Edit reply' : 'Reply publicly'}
        icon="chatbubble-ellipses"
        variant="secondary"
        onPress={() => setOpen(true)}
        testID={`reply-open-${review.id}`}
      />
    );
  }
  return (
    <View style={styles.box}>
      <TextField
        label="Your public reply"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={600}
        hint="Everyone can see it. Keep it kind; no phone numbers or links."
        testID={`reply-text-${review.id}`}
      />
      {reply.isError ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {errorMessage(reply.error)}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Button
          label="Cancel"
          variant="tertiary"
          onPress={() => setOpen(false)}
          style={styles.flex}
        />
        <Button
          label="Post reply"
          disabled={text.trim().length < 2}
          loading={reply.isPending}
          onPress={() => reply.mutate(text.trim(), { onSuccess: () => setOpen(false) })}
          style={styles.flex}
          testID={`reply-send-${review.id}`}
        />
      </View>
    </View>
  );
}

export default function ProviderReviewsScreen() {
  const params = useLocalSearchParams<{ ownerType: string; id: string }>();
  const ownerType: OwnerType = params.ownerType === 'clinic' ? 'clinic' : 'provider_profile';
  const page = useProviderReviews(ownerType, params.id);
  useRefreshOnFocus(page.refetch);

  if (page.isPending) return <LoadingState message="Loading reviews…" />;
  if (page.isError) {
    return (
      <ErrorState
        onRetry={() => void page.refetch()}
        requestId={isApiError(page.error) ? page.error.requestId : null}
      />
    );
  }
  const { summary, items } = page.data;
  const replied = items.filter((r) => r.reply).length;
  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="provider-reviews"
        underHeader
        eyebrow="Reviews"
        title={summary.review_count ? 'What pet parents say' : 'No reviews yet'}
        subtitle="Only pet parents with a completed visit can review. A thoughtful reply shows others you care."
        overlap
        refreshControl={
          <RefreshControl
            refreshing={page.isRefetching}
            onRefresh={() => void page.refetch()}
            tintColor={colors.primary}
          />
        }
        heroContent={
          <HeroStats
            items={[
              {
                value: summary.rating != null ? `★ ${summary.rating.toFixed(1)}` : '–',
                label: 'Average',
              },
              { value: String(summary.review_count), label: 'Published' },
              { value: `${replied}/${items.length}`, label: 'Replied' },
            ]}
          />
        }
      >
        {items.length ? (
          items.map((r) => (
            <Card key={r.id}>
              <ReviewCard
                review={r}
                replyFrom="you"
                showReport={r.can_reply}
                footer={<ReplyBox review={r} />}
              />
            </Card>
          ))
        ) : (
          <Card>
            <EmptyState
              compact
              icon="star-outline"
              tone="peach"
              title="No reviews yet"
              message="After a completed visit, pet parents are invited to rate it."
            />
          </Card>
        )}
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  pending: { flexDirection: 'row' },
});
