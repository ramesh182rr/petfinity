import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/states/StateViews';
import { Card, HeroScreen, SegmentedControl, Text } from '@/components/ui';
import type { InboxScope } from '@/features/bookings/api';
import { BookingCard } from '@/features/bookings/BookingCard';
import { groupByDay } from '@/features/bookings/format';
import { useListingBookings } from '@/features/bookings/hooks';
import type { OwnerType } from '@/features/catalog/types';
import { HeroStats } from '@/features/discovery/DetailParts';
import { useClinic, useProviderProfile } from '@/features/providers/hooks';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, spacing } from '@/theme';

const EMPTY: Record<InboxScope, { title: string; message: string }> = {
  requests: {
    title: 'No requests waiting',
    message: 'Requests for home visits and request-only services appear here for you to confirm.',
  },
  upcoming: {
    title: 'No upcoming appointments',
    message: 'Confirmed appointments show up here, grouped by day.',
  },
  past: {
    title: 'Nothing here yet',
    message: 'Completed, cancelled and missed appointments are kept here.',
  },
};

/** Provider inbox for one listing: requests to answer, the day's appointments, history. */
export default function ProviderInboxScreen() {
  const params = useLocalSearchParams<{ ownerType: string; id: string; scope?: string }>();
  const ownerType: OwnerType = params.ownerType === 'clinic' ? 'clinic' : 'provider_profile';
  const isClinic = ownerType === 'clinic';
  const clinic = useClinic(params.id, isClinic);
  const profile = useProviderProfile(params.id, !isClinic);
  const [scope, setScope] = useState<InboxScope>(
    params.scope === 'upcoming' || params.scope === 'past' ? params.scope : 'requests',
  );
  const requests = useListingBookings(ownerType, params.id, 'requests');
  const upcoming = useListingBookings(ownerType, params.id, 'upcoming');
  const past = useListingBookings(ownerType, params.id, 'past');
  const current = { requests, upcoming, past }[scope];
  useRefreshOnFocus(requests.refetch, upcoming.refetch, past.refetch);

  const name = isClinic ? clinic.data?.name : profile.data?.display_name;
  const todayCount =
    upcoming.data?.items.filter(
      (b) => new Date(b.start_at).toDateString() === new Date().toDateString(),
    ).length ?? 0;
  const items = current.data?.items ?? [];
  const groups = scope === 'requests' ? [{ title: '', items }] : groupByDay(items);

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="provider-inbox"
        underHeader
        eyebrow="Appointments"
        title={name ?? 'Inbox'}
        subtitle="Answer requests, check pets in and keep your day on track."
        gradient="dusk"
        overlap
        refreshControl={
          <RefreshControl
            refreshing={current.isRefetching}
            onRefresh={() => void current.refetch()}
            tintColor={colors.primary}
          />
        }
        heroContent={
          <HeroStats
            items={[
              { value: String(requests.data?.items.length ?? '–'), label: 'Requests' },
              { value: String(upcoming.data ? todayCount : '–'), label: 'Today' },
              { value: String(upcoming.data?.items.length ?? '–'), label: 'Upcoming' },
            ]}
          />
        }
      >
        <Card>
          <SegmentedControl<InboxScope>
            accessibilityLabel="Show"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'requests', label: 'Requests' },
              { value: 'upcoming', label: 'Upcoming' },
              { value: 'past', label: 'Past' },
            ]}
          />
        </Card>

        {current.isPending ? (
          <View style={styles.list}>
            <Skeleton height={104} />
            <Skeleton height={104} />
          </View>
        ) : current.isError ? (
          <Card>
            <ErrorState
              onRetry={() => void current.refetch()}
              requestId={isApiError(current.error) ? current.error.requestId : null}
            />
          </Card>
        ) : items.length ? (
          groups.map((group) => (
            <View key={group.title || 'all'} style={styles.list}>
              {group.title ? (
                <Text variant="subheading" style={styles.heading}>
                  {group.title}
                </Text>
              ) : null}
              {group.items.map((b) => (
                <BookingCard
                  key={b.id}
                  booking={b}
                  provider
                  onPress={() =>
                    router.push({ pathname: '/provider/booking/[id]', params: { id: b.id } })
                  }
                />
              ))}
            </View>
          ))
        ) : (
          <Card testID={`inbox-empty-${scope}`}>
            <EmptyState
              compact
              icon={scope === 'requests' ? 'mail-open-outline' : 'calendar-outline'}
              tone={scope === 'requests' ? 'peach' : 'sage'}
              title={EMPTY[scope].title}
              message={EMPTY[scope].message}
            />
          </Card>
        )}
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  heading: { paddingHorizontal: spacing.xs },
});
