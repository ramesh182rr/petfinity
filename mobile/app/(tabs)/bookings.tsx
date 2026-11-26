import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/states/StateViews';
import { Card, HeroScreen, SegmentedControl, Text } from '@/components/ui';
import { BookingCard } from '@/features/bookings/BookingCard';
import { useBookings } from '@/features/bookings/hooks';
import type { BookingScope } from '@/features/bookings/types';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { colors, spacing } from '@/theme';

export default function BookingsScreen() {
  const [scope, setScope] = useState<BookingScope>('upcoming');
  const bookings = useBookings(scope);
  useRefreshOnFocus(bookings.refetch);
  const items = bookings.data?.items ?? [];
  const next = scope === 'upcoming' ? items[0] : undefined;

  return (
    <HeroScreen
      testID="bookings-screen"
      eyebrow="Bookings"
      title="Your appointments"
      subtitle={
        next
          ? `Next: ${next.service_title} at ${next.listing.name}`
          : 'Vet visits and caretaker stays, all in one place.'
      }
      gradient="dusk"
      overlap
      refreshControl={
        <RefreshControl
          refreshing={bookings.isRefetching}
          onRefresh={() => void bookings.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <Card>
        <SegmentedControl<BookingScope>
          accessibilityLabel="Show"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'past', label: 'Past' },
          ]}
        />
      </Card>

      {bookings.isPending ? (
        <View style={styles.list} testID="bookings-loading">
          <Skeleton height={104} />
          <Skeleton height={104} />
        </View>
      ) : bookings.isError ? (
        <Card>
          <ErrorState
            onRetry={() => void bookings.refetch()}
            requestId={isApiError(bookings.error) ? bookings.error.requestId : null}
          />
        </Card>
      ) : items.length ? (
        <View style={styles.list}>
          <Text variant="caption" color="textMuted" style={styles.count}>
            {items.length} {scope === 'upcoming' ? 'upcoming' : 'past'}{' '}
            {items.length === 1 ? 'appointment' : 'appointments'}
          </Text>
          {items.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              onPress={() => router.push({ pathname: '/bookings/[id]', params: { id: b.id } })}
            />
          ))}
        </View>
      ) : (
        <Card testID="bookings-empty">
          <EmptyState
            compact
            icon={scope === 'upcoming' ? 'calendar-outline' : 'time-outline'}
            tone="sage"
            title={scope === 'upcoming' ? 'No upcoming appointments' : 'Nothing here yet'}
            message={
              scope === 'upcoming'
                ? 'Find a verified vet or clinic nearby and book a time that suits you.'
                : 'Completed and cancelled appointments will show up here.'
            }
            action={
              scope === 'upcoming'
                ? { label: 'Find a vet', onPress: () => router.push('/discover') }
                : undefined
            }
          />
        </Card>
      )}
    </HeroScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  count: { paddingHorizontal: spacing.xs },
});
