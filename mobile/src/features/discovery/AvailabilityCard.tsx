import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { upcomingDays } from '@/features/catalog/format';
import { DayStrip, SlotGrid } from '@/features/catalog/SlotPicker';
import { spacing } from '@/theme';

import { usePublicSlots } from './hooks';
import type { ListingKind, PublicService } from './types';

/**
 * Real open times for the selected service. Picking a slot is possible now;
 * the booking flow itself arrives in milestone 2.7, so the button says so.
 */
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
        selected={slot}
        onSelect={setSlot}
      />
      <Button
        label={slot ? 'Booking opens soon' : 'Pick a time'}
        icon="calendar"
        size="lg"
        fullWidth
        disabled
        onPress={() => undefined}
        testID="book-cta"
      />
      <Text variant="caption" color="textMuted" align="center">
        In-app booking is on its way. You can already compare real open times.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  head: { gap: spacing.xxs },
});
