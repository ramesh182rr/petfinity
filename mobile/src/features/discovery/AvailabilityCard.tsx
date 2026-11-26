import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { formatTime, upcomingDays } from '@/features/catalog/format';
import { DayStrip, SlotGrid } from '@/features/catalog/SlotPicker';
import { spacing } from '@/theme';

import { usePublicSlots } from './hooks';
import type { ListingKind, PublicService } from './types';

/** Real open times for the selected service; pick one to continue to the booking review. */
export function AvailabilityCard({
  kind,
  id,
  service,
}: {
  kind: ListingKind;
  id: string;
  service: PublicService | undefined;
}) {
  const days = upcomingDays(14);
  const [date, setDate] = useState(days[0]?.iso ?? '');
  const [slot, setSlot] = useState<string | null>(null);
  const slots = usePublicSlots(kind, id, service?.id ?? null, date);
  // A slot picked for another service or day doesn't carry over.
  const chosen = slots.data?.slots.find((s) => s.start === slot);

  return (
    <Card style={styles.card} testID="availability">
      <View style={styles.head}>
        <Text variant="bodyStrong">{service ? service.title : 'Choose a service'}</Text>
        <Text variant="caption" color="textMuted">
          Times are shown in India time.
        </Text>
      </View>
      <DayStrip
        days={days}
        selected={date}
        onSelect={(iso) => {
          setDate(iso);
          setSlot(null);
        }}
      />
      <SlotGrid
        slots={slots.data?.slots}
        loading={!!service && slots.isPending}
        emptyMessage={
          slots.isError
            ? "Couldn't load times. Try another day."
            : 'No open times that day. Try another day.'
        }
        selected={chosen?.start ?? null}
        onSelect={setSlot}
      />
      <Button
        label={chosen ? `Continue with ${formatTime(chosen.local_start)}` : 'Pick a time'}
        icon="arrow-forward"
        size="lg"
        fullWidth
        disabled={!chosen || !service}
        onPress={() => {
          if (!chosen || !service) return;
          router.push({
            pathname: '/book',
            params: { kind, listingId: id, serviceId: service.id, start: chosen.start },
          });
        }}
        testID="book-cta"
      />
      <Text variant="caption" color="textMuted" align="center">
        You’ll review the details before booking. Payment is a mock: nothing is charged.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  head: { gap: spacing.xxs },
});
