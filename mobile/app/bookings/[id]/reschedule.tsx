import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import { Button, Card, ListRow, Screen, Text } from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { formatWhen } from '@/features/bookings/format';
import { useBooking, useRescheduleBooking } from '@/features/bookings/hooks';
import { formatTime, upcomingDays } from '@/features/catalog/format';
import { DayStrip, SlotGrid } from '@/features/catalog/SlotPicker';
import { usePublicSlots } from '@/features/discovery/hooks';
import { spacing } from '@/theme';

export default function RescheduleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useBooking(id);
  const move = useRescheduleBooking(id);
  const days = upcomingDays(14);
  const [date, setDate] = useState(days[0]?.iso ?? '');
  const [slot, setSlot] = useState<string | null>(null);
  const b = booking.data;
  const slots = usePublicSlots(
    b?.listing.kind ?? 'clinic',
    b?.listing.id ?? '',
    b?.service_id ?? null,
    date,
  );

  if (booking.isPending) return <LoadingState message="Loading appointment…" />;
  if (booking.isError || !b) {
    return (
      <ErrorState
        onRetry={() => void booking.refetch()}
        requestId={isApiError(booking.error) ? booking.error.requestId : null}
      />
    );
  }

  // The current time isn't a move; hide it.
  const sameTime = (iso: string) => new Date(iso).getTime() === new Date(b.start_at).getTime();
  const options = slots.data?.slots.filter((s) => !sameTime(s.start));
  const chosen = options?.find((s) => s.start === slot);
  const needsOk = b.confirmation_mode === 'request';

  return (
    <Screen edges={[]} testID="reschedule-screen">
      <Card>
        <ListRow
          icon="calendar"
          tone="lavender"
          title={b.service_title}
          subtitle={`Now: ${formatWhen(b.start_at)} · ${b.listing.name}`}
        />
      </Card>
      <Card style={styles.card}>
        <Text variant="bodyStrong">Pick a new time</Text>
        <DayStrip
          days={days}
          selected={date}
          onSelect={(iso) => {
            setDate(iso);
            setSlot(null);
          }}
        />
        <SlotGrid
          slots={options}
          loading={slots.isPending}
          emptyMessage="No open times that day. Try another day."
          selected={chosen?.start ?? null}
          onSelect={setSlot}
        />
      </Card>
      {needsOk ? (
        <Text variant="caption" color="textMuted" align="center">
          The vet confirms the new time again. Your old time is released.
        </Text>
      ) : null}
      {move.isError ? (
        <Text variant="body" color="error" accessibilityRole="alert">
          {errorMessage(move.error)}
        </Text>
      ) : null}
      <View>
        <Button
          testID="reschedule-submit"
          label={chosen ? `Move to ${formatTime(chosen.local_start)}` : 'Pick a time'}
          icon="swap-horizontal"
          size="lg"
          fullWidth
          disabled={!chosen}
          loading={move.isPending}
          onPress={() =>
            chosen &&
            move.mutate(chosen.start, {
              onSuccess: () => (router.canGoBack() ? router.back() : router.replace('/bookings')),
            })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
