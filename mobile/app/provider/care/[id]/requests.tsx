import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { EmptyState, ErrorState, Skeleton } from '@/components/states/StateViews';
import { Card, HeroScreen, IconBadge, SegmentedControl, StatusPill, Text } from '@/components/ui';
import { CARE_LABEL, careDates, careWhen, closesLabel, unitsLabel } from '@/features/care/format';
import { useCareFeed } from '@/features/care/hooks';
import type { CaretakerRequest } from '@/features/care/types';
import { formatRupees } from '@/features/catalog/format';
import { HeroStats } from '@/features/discovery/DetailParts';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, elevation, radius, spacing } from '@/theme';

export const OFFER_STATUS: Record<
  string,
  { label: string; tone: 'primary' | 'success' | 'neutral' | 'warning' }
> = {
  pending: { label: 'Offer sent', tone: 'primary' },
  accepted: { label: 'You got it', tone: 'success' },
  declined: { label: 'Not chosen', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
};

function FeedCard({ r, profileId }: { r: CaretakerRequest; profileId: string }) {
  const t = CARE_LABEL[r.care_type];
  const offer = r.my_offer ? OFFER_STATUS[r.my_offer.status] : null;
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/provider/care/[id]/request/[rid]',
          params: { id: profileId, rid: r.id },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`${t.label} in ${r.locality}, ${careWhen(r.start_at, r.end_at)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`feed-${r.id}`}
    >
      <View style={styles.cardHead}>
        <IconBadge name={t.icon} tone={t.tone} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {t.label} · {unitsLabel(r.units, r.unit)}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {careDates(r.start_at, r.end_at)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </View>
      <View style={styles.meta}>
        <Ionicons name="paw-outline" size={14} color={colors.textMuted} />
        <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>
          {r.pets.map((p) => `${p.name} (${p.breed ?? p.species.replace('_', ' ')})`).join(', ')}
        </Text>
      </View>
      <View style={styles.meta}>
        <Ionicons name="location-outline" size={14} color={colors.textMuted} />
        <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.flex}>
          {r.locality} · about {r.distance_km} km away
        </Text>
      </View>
      <View style={styles.footer}>
        {offer ? (
          <StatusPill label={offer.label} tone={offer.tone} />
        ) : (
          <StatusPill label={closesLabel(r.offers_close_at, r.accepting_offers)} tone="warning" />
        )}
        <Text variant="label" color="primary">
          {r.my_offer
            ? formatRupees(r.my_offer.price_minor)
            : r.budget_minor != null
              ? `Budget ${formatRupees(r.budget_minor)}`
              : r.suggested_price_minor != null
                ? `~${formatRupees(r.suggested_price_minor)}`
                : ''}
        </Text>
      </View>
    </Pressable>
  );
}

/** Caretaker: requests near you, and the ones you've offered on (3.5). */
export default function CareFeedScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [scope, setScope] = useState<'open' | 'offered'>('open');
  const open = useCareFeed(id, 'open');
  const offered = useCareFeed(id, 'offered');
  const current = scope === 'open' ? open : offered;
  useRefreshOnFocus(open.refetch, offered.refetch);
  const items = current.data?.items ?? [];
  const won = offered.data?.items.filter((r) => r.my_offer?.status === 'accepted').length ?? 0;
  const notVerified = isApiError(current.error) && current.error.code === 'not_verified';

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="care-feed"
        underHeader
        eyebrow="Care requests"
        title="Pet parents near you"
        subtitle="Send an offer with your price. The parent compares and chooses."
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
              { value: String(open.data?.items.length ?? '–'), label: 'Open now' },
              {
                value: String(
                  offered.data?.items.filter((r) => r.my_offer?.status === 'pending').length ?? '–',
                ),
                label: 'Waiting',
              },
              { value: String(won), label: 'Won' },
            ]}
          />
        }
      >
        <Card>
          <SegmentedControl<'open' | 'offered'>
            accessibilityLabel="Show"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'open', label: 'Open requests' },
              { value: 'offered', label: 'My offers' },
            ]}
          />
        </Card>
        {current.isPending ? (
          <View style={styles.list}>
            <Skeleton height={140} />
            <Skeleton height={140} />
          </View>
        ) : notVerified ? (
          <Card>
            <EmptyState
              compact
              icon="shield-checkmark-outline"
              tone="peach"
              title="Get verified to see requests"
              message="Requests reach you once Petfinity has checked your identity and address."
              action={{
                label: 'Open verification',
                onPress: () => router.push(`/provider/verify/provider_profile/${id}`),
              }}
            />
          </Card>
        ) : current.isError ? (
          <Card>
            <ErrorState
              onRetry={() => void current.refetch()}
              requestId={isApiError(current.error) ? current.error.requestId : null}
            />
          </Card>
        ) : items.length ? (
          <View style={styles.list}>
            {items.map((r) => (
              <FeedCard key={r.id} r={r} profileId={id} />
            ))}
          </View>
        ) : (
          <Card testID={`care-feed-empty-${scope}`}>
            <EmptyState
              compact
              icon={scope === 'open' ? 'mail-open-outline' : 'pricetag-outline'}
              tone="sage"
              title={scope === 'open' ? 'No requests right now' : 'No offers yet'}
              message={
                scope === 'open'
                  ? 'New requests that match your services, area and free dates appear here.'
                  : 'Requests you send offers on are tracked here.'
              }
            />
          </Card>
        )}
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xxs },
  list: { gap: spacing.md },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
