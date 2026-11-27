import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import {
  Button,
  Card,
  ListRow,
  Screen,
  StarInput,
  Text,
  TextField,
  ratingLabel,
} from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { formatDay } from '@/features/bookings/format';
import { useBooking } from '@/features/bookings/hooks';
import type { BookingDetail } from '@/features/bookings/types';
import { useSaveReview } from '@/features/reviews/hooks';
import { spacing } from '@/theme';

/** Write (or edit) the review of a completed visit. */
export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useBooking(id);
  if (booking.isPending) return <LoadingState message="Loading visit…" />;
  if (booking.isError) {
    return (
      <ErrorState
        onRetry={() => void booking.refetch()}
        requestId={isApiError(booking.error) ? booking.error.requestId : null}
      />
    );
  }
  return <ReviewForm booking={booking.data} />;
}

function ReviewForm({ booking }: { booking: BookingDetail }) {
  const existing = booking.review ?? null;
  const save = useSaveReview(booking.id, existing?.id);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [text, setText] = useState(existing?.text ?? '');
  const pets = booking.pets.map((p) => p.name).join(', ');

  const submit = () =>
    save.mutate(
      { rating, text: text.trim() || null },
      {
        onSuccess: () =>
          router.canGoBack()
            ? router.back()
            : router.replace({ pathname: '/bookings/[id]', params: { id: booking.id } }),
      },
    );

  return (
    <Screen edges={[]} testID="review-screen">
      <Card>
        <ListRow
          icon={booking.listing.kind === 'clinic' ? 'medkit' : 'home'}
          tone="lavender"
          title={booking.listing.name}
          subtitle={`${booking.service_title} for ${pets} · ${formatDay(booking.start_at)}`}
        />
      </Card>
      <Card style={styles.card}>
        <Text variant="subheading" align="center">
          How was the visit?
        </Text>
        <StarInput value={rating} onChange={setRating} testID="rating" />
        <Text variant="label" color={rating ? 'primary' : 'textMuted'} align="center">
          {rating ? ratingLabel(rating) : 'Tap a star to rate'}
        </Text>
      </Card>
      <Card style={styles.card}>
        <TextField
          testID="review-text"
          label="Tell other pet parents (optional)"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={1000}
          placeholder="How were the vet and staff? Was the wait OK? How is your pet now?"
          hint="Please don’t include phone numbers, emails or links. Reviews with them are held for a check."
        />
      </Card>
      {save.isError ? (
        <Text variant="body" color="error" accessibilityRole="alert" testID="review-error">
          {errorMessage(save.error)}
        </Text>
      ) : null}
      <View>
        <Button
          testID="review-submit"
          label={existing ? 'Save changes' : 'Post review'}
          icon="star"
          size="lg"
          fullWidth
          disabled={!rating}
          loading={save.isPending}
          onPress={submit}
        />
      </View>
      <Text variant="caption" color="textMuted" align="center">
        Your first name and last initial are shown with your review.
        {existing ? '' : ' You can edit it for 30 days after the visit.'}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
