import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/states/StateViews';
import { Button, Card, Chip, HeroScreen, SegmentedControl, Text } from '@/components/ui';
import { CATEGORIES } from '@/features/catalog/format';
import { originLabel } from '@/features/discovery/format';
import { useSearch } from '@/features/discovery/hooks';
import { ListingCard } from '@/features/discovery/ListingCard';
import { getDeviceLocation, LOCATION_MESSAGES } from '@/features/discovery/location';
import { DEFAULT_FILTERS, useDiscoveryStore } from '@/features/discovery/store';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import type { KindFilter, Listing } from '@/features/discovery/types';
import { colors, fonts, radius, spacing } from '@/theme';

const SEARCH_DELAY_MS = 350;

function ListingSkeleton() {
  return (
    <Card style={styles.skeletonCard}>
      <View style={styles.skeletonTop}>
        <Skeleton width={52} height={52} rounded />
        <View style={styles.flexGap}>
          <Skeleton width="70%" height={18} />
          <Skeleton width="50%" height={14} />
        </View>
      </View>
      <Skeleton height={14} />
    </Card>
  );
}

function ChooseLocation() {
  const setOrigin = useDiscoveryStore((s) => s.setOrigin);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const locateMe = async () => {
    setLocating(true);
    setMessage(null);
    const result = await getDeviceLocation();
    setLocating(false);
    if (result.ok) setOrigin({ type: 'device', ...result.location });
    else setMessage(LOCATION_MESSAGES[result.reason]);
  };
  return (
    <Card style={styles.choose} testID="choose-location">
      <EmptyState
        compact
        icon="location"
        tone="lavender"
        title="Where should we look?"
        message="Use your location, or pick one of our launch cities in Tamil Nadu, Kerala and Bengaluru."
      />
      <View style={styles.buttonRow}>
        <Button
          label="Near me"
          icon="navigate"
          loading={locating}
          onPress={() => void locateMe()}
          style={styles.flex}
          testID="use-location"
        />
        <Button
          label="Choose city"
          icon="business"
          variant="secondary"
          onPress={() => router.push('/discover/area')}
          style={styles.flex}
          testID="choose-area"
        />
      </View>
      {message ? (
        <Text variant="caption" color="error" accessibilityRole="alert" align="center">
          {message}
        </Text>
      ) : null}
    </Card>
  );
}

export default function DiscoverScreen() {
  const origin = useDiscoveryStore((s) => s.origin);
  const filters = useDiscoveryStore((s) => s.filters);
  const setFilters = useDiscoveryStore((s) => s.setFilters);
  const resetFilters = useDiscoveryStore((s) => s.resetFilters);
  const [text, setText] = useState(filters.q);

  // Debounce typing into the search filter.
  useEffect(() => {
    const timer = setTimeout(() => setFilters({ q: text }), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, setFilters]);

  const results = useSearch(origin, filters);
  // Open-now and next-slot go stale quickly: refresh when the tab regains focus.
  useRefreshOnFocus(results.refetch);
  const items: Listing[] = results.data?.pages.flatMap((p) => p.items) ?? [];
  const total = results.data?.pages[0]?.total ?? 0;
  const filtered =
    filters.kind !== DEFAULT_FILTERS.kind ||
    filters.category !== null ||
    filters.openNow ||
    filters.emergency ||
    !!filters.q;

  const open = (listing: Listing) =>
    router.push(
      listing.kind === 'clinic'
        ? { pathname: '/discover/clinic/[id]', params: { id: listing.id } }
        : { pathname: '/discover/vet/[id]', params: { id: listing.id } },
    );

  return (
    <HeroScreen
      testID="discover-screen"
      eyebrow="Discover"
      title="Trusted care near you"
      subtitle="Every vet and clinic here is verified by Petfinity."
      overlap
      refreshControl={
        <RefreshControl
          refreshing={results.isRefetching && !results.isFetchingNextPage}
          onRefresh={() => void results.refetch()}
          tintColor={colors.primary}
        />
      }
      heroContent={
        <View style={styles.heroControls}>
          <Pressable
            onPress={() => router.push('/discover/area')}
            accessibilityRole="button"
            accessibilityLabel={`Location: ${originLabel(origin)}. Change`}
            style={({ pressed }) => [styles.locationPill, pressed && styles.pressed]}
            testID="location-pill"
          >
            <Ionicons
              name={origin?.type === 'device' ? 'navigate' : 'location'}
              size={16}
              color={colors.textOnPrimary}
            />
            <Text variant="label" color="textOnPrimary">
              {originLabel(origin)}
            </Text>
            {origin ? (
              <Text variant="caption" style={styles.radius}>
                · {filters.radiusKm} km
              </Text>
            ) : null}
            <Ionicons name="chevron-down" size={16} color={colors.textOnPrimary} />
          </Pressable>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Search clinics, vets or areas"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              accessibilityLabel="Search"
              style={styles.searchInput}
              testID="search-input"
            />
            {text ? (
              <Pressable
                onPress={() => setText('')}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>
      }
    >
      <Card style={styles.filters}>
        <SegmentedControl<KindFilter>
          accessibilityLabel="Show"
          value={filters.kind}
          onChange={(kind) => setFilters({ kind })}
          options={[
            { value: 'all', label: 'All' },
            { value: 'clinic', label: 'Clinics' },
            { value: 'vet', label: 'Home visits' },
          ]}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.chipRow}
        >
          <Chip
            icon="flash"
            label="Open now"
            selected={filters.openNow}
            onPress={() => setFilters({ openNow: !filters.openNow })}
            testID="filter-open-now"
          />
          <Chip
            icon="pricetag"
            label="Lowest price"
            selected={filters.sort === 'price'}
            onPress={() => setFilters({ sort: filters.sort === 'price' ? 'distance' : 'price' })}
            testID="filter-price"
          />
          <Chip
            icon="star"
            label="Top rated"
            selected={filters.sort === 'rating'}
            onPress={() => setFilters({ sort: filters.sort === 'rating' ? 'distance' : 'rating' })}
            testID="filter-rating"
          />
          <Chip
            icon="medkit"
            label="Emergency"
            selected={filters.emergency}
            onPress={() => setFilters({ emergency: !filters.emergency })}
            testID="filter-emergency"
          />
        </ScrollView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bleed}
          contentContainerStyle={styles.chipRow}
          testID="category-chips"
        >
          <Chip
            label="All services"
            selected={filters.category === null}
            onPress={() => setFilters({ category: null })}
          />
          {CATEGORIES.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              selected={filters.category === c.value}
              onPress={() =>
                setFilters({ category: filters.category === c.value ? null : c.value })
              }
            />
          ))}
        </ScrollView>
      </Card>

      {!origin ? (
        <ChooseLocation />
      ) : results.isPending ? (
        <View style={styles.list} testID="results-loading">
          <ListingSkeleton />
          <ListingSkeleton />
        </View>
      ) : results.isError ? (
        <Card>
          <ErrorState
            onRetry={() => void results.refetch()}
            requestId={isApiError(results.error) ? results.error.requestId : null}
          />
        </Card>
      ) : items.length ? (
        <View style={styles.list}>
          <View style={styles.resultsHead}>
            <Text variant="subheading" testID="results-count">
              {total} verified {total === 1 ? 'listing' : 'listings'}
            </Text>
            <Text variant="caption" color="textMuted">
              {filters.sort === 'price'
                ? 'Lowest price first'
                : filters.sort === 'rating'
                  ? 'Top rated first'
                  : 'Nearest first'}
            </Text>
          </View>
          {items.map((listing) => (
            <ListingCard key={listing.id} listing={listing} onPress={() => open(listing)} />
          ))}
          {results.hasNextPage ? (
            <Button
              label="Show more"
              variant="secondary"
              loading={results.isFetchingNextPage}
              onPress={() => void results.fetchNextPage()}
              fullWidth
            />
          ) : null}
        </View>
      ) : (
        <Card testID="no-results">
          <EmptyState
            compact
            icon="search"
            tone="peach"
            title="No verified providers here yet"
            message={
              filtered
                ? 'Nothing matches these filters. Clear them to see everyone nearby.'
                : `We're still onboarding vets within ${filters.radiusKm} km of ${originLabel(origin).toLowerCase() === 'near you' ? 'you' : originLabel(origin)}.`
            }
            action={
              filtered
                ? {
                    label: 'Clear filters',
                    onPress: () => {
                      setText('');
                      resetFilters();
                      setFilters({ q: '' });
                    },
                  }
                : filters.radiusKm < 25
                  ? { label: 'Search within 25 km', onPress: () => setFilters({ radiusKm: 25 }) }
                  : undefined
            }
          />
        </Card>
      )}
    </HeroScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGap: { flex: 1, gap: spacing.sm },
  pressed: { opacity: 0.85 },
  heroControls: { gap: spacing.md },
  locationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  radius: { color: colors.primaryTint },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  filters: { gap: spacing.md },
  // Chip rows scroll edge to edge inside the card.
  bleed: { marginHorizontal: -spacing.lg },
  chipRow: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  list: { gap: spacing.md },
  resultsHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  skeletonCard: { gap: spacing.md },
  skeletonTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  choose: { gap: spacing.md },
  buttonRow: { flexDirection: 'row', gap: spacing.md },
});
