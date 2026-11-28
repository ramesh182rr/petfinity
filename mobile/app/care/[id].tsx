import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, RefreshControl, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import {
  Button,
  Card,
  HeroScreen,
  IconBadge,
  InitialsAvatar,
  ListRow,
  SectionHeader,
  Stars,
  StatusPill,
  Text,
} from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import {
  AT_CARETAKER_HOME,
  CARE_LABEL,
  careWhen,
  closesLabel,
  petsLabel,
  REQUEST_STATUS,
  unitsLabel,
} from '@/features/care/format';
import { useAcceptOffer, useCancelCareRequest, useCareRequest } from '@/features/care/hooks';
import type { CareOffer, CareRequest } from '@/features/care/types';
import { formatRupees } from '@/features/catalog/format';
import { HeroStats } from '@/features/discovery/DetailParts';
import { avatarName } from '@/features/discovery/format';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, radius, spacing } from '@/theme';

function OfferCard({
  offer,
  request,
  onAccept,
  busy,
}: {
  offer: CareOffer;
  request: CareRequest;
  onAccept: () => void;
  busy: boolean;
}) {
  const c = offer.caretaker;
  const atHome = AT_CARETAKER_HOME.includes(request.care_type);
  const home = [
    c.home_type === 'independent_house'
      ? 'Independent house'
      : c.home_type === 'apartment'
        ? 'Apartment'
        : null,
    c.outdoor_space ? 'Outdoor space' : c.outdoor_space === false ? 'No outdoor space' : null,
    c.pets_at_home ? `Pets: ${c.pets_at_home}` : null,
  ].filter(Boolean);
  const open = request.status === 'open' && offer.status === 'pending';
  return (
    <Card style={styles.offer} testID={`offer-${offer.id}`}>
      <View style={styles.offerHead}>
        <InitialsAvatar name={avatarName(c.display_name)} size={48} onDark={false} />
        <View style={styles.flex}>
          <View style={styles.nameRow}>
            <Text variant="subheading" numberOfLines={1} style={styles.shrink}>
              {c.display_name}
            </Text>
            <Ionicons
              name="shield-checkmark"
              size={16}
              color={colors.success}
              accessibilityLabel="Verified"
            />
          </View>
          {c.review_count && c.rating != null ? (
            <View style={styles.nameRow}>
              <Stars value={c.rating} size={14} />
              <Text variant="caption" color="textMuted">
                {c.rating.toFixed(1)} ({c.review_count})
              </Text>
            </View>
          ) : (
            <Text variant="caption" color="textMuted">
              New on Petfinity
            </Text>
          )}
        </View>
        <View style={styles.price}>
          <Text variant="heading" color="primary">
            {formatRupees(offer.price_minor)}
          </Text>
          <Text variant="caption" color="textMuted">
            total
          </Text>
        </View>
      </View>
      <View style={styles.facts}>
        {c.years_experience != null ? (
          <StatusPill label={`${c.years_experience} yrs experience`} tone="primary" />
        ) : null}
        <StatusPill
          label={c.completed_care ? `${c.completed_care} stays done` : 'First booking'}
          tone="neutral"
        />
        {c.area_name ? <StatusPill label={c.area_name} tone="neutral" /> : null}
      </View>
      {atHome && home.length ? (
        <View style={styles.home}>
          <Ionicons name="home-outline" size={16} color={colors.textMuted} />
          <Text variant="caption" color="textMuted" style={styles.flex}>
            {home.join(' · ')}
          </Text>
        </View>
      ) : null}
      {offer.message ? (
        <View style={styles.quote}>
          <Text variant="body">“{offer.message}”</Text>
        </View>
      ) : null}
      {open ? (
        <Button
          label={`Accept · ${formatRupees(offer.price_minor)}`}
          icon="checkmark-circle"
          fullWidth
          loading={busy}
          onPress={onAccept}
          testID={`accept-${offer.id}`}
        />
      ) : (
        <StatusPill
          label={offer.status === 'accepted' ? 'Accepted' : 'Not chosen'}
          tone={offer.status === 'accepted' ? 'success' : 'neutral'}
        />
      )}
    </Card>
  );
}

/** Parent: one request, its offers to compare, and accept (3.4). */
export default function CareRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const request = useCareRequest(id);
  const accept = useAcceptOffer(id);
  const cancel = useCancelCareRequest(id);
  useRefreshOnFocus(request.refetch);

  if (request.isPending) return <LoadingState message="Loading request…" />;
  if (request.isError) {
    return (
      <ErrorState
        onRetry={() => void request.refetch()}
        requestId={isApiError(request.error) ? request.error.requestId : null}
      />
    );
  }
  const r = request.data;
  const t = CARE_LABEL[r.care_type];
  const status = REQUEST_STATUS[r.status] ?? REQUEST_STATUS.open!;
  const live = r.offers.filter((o) => o.status !== 'declined' || r.status !== 'open');

  const confirmAccept = (offer: CareOffer) =>
    Alert.alert(
      `Book ${offer.caretaker.display_name}?`,
      `${formatRupees(offer.price_minor)} for ${unitsLabel(r.units, r.unit)}. Free cancellation until 48 hours before the start, then 50% back. Your address is shared with them once you book.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Book',
          onPress: () =>
            accept.mutate(offer.id, {
              onSuccess: (b) =>
                router.replace({ pathname: '/bookings/[id]', params: { id: b.id, new: '1' } }),
            }),
        },
      ],
    );

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="care-request"
        underHeader
        eyebrow={`${t.label} request`}
        title={unitsLabel(r.units, r.unit).replace(/^./, (c) => c.toUpperCase())}
        subtitle={careWhen(r.start_at, r.end_at)}
        overlap
        refreshControl={
          <RefreshControl
            refreshing={request.isRefetching}
            onRefresh={() => void request.refetch()}
            tintColor={colors.primary}
          />
        }
        heroContent={
          <View style={styles.heroContent}>
            <View style={styles.pillRow}>
              <StatusPill label={status.label} tone="onDark" testID="care-request-status" />
            </View>
            <HeroStats
              items={[
                { value: String(r.offer_count), label: r.offer_count === 1 ? 'Offer' : 'Offers' },
                { value: String(r.pets.length), label: r.pets.length === 1 ? 'Pet' : 'Pets' },
                {
                  value: r.budget_minor != null ? formatRupees(r.budget_minor) : '–',
                  label: 'Budget',
                },
              ]}
            />
          </View>
        }
      >
        {r.status === 'booked' && r.booking_id ? (
          <Card style={styles.banner} testID="care-booked">
            <IconBadge name="checkmark-circle" tone="sage" />
            <View style={styles.flex}>
              <Text variant="bodyStrong">You’re booked</Text>
              <Text variant="caption" color="textMuted">
                Manage payment, changes and check-in from the booking.
              </Text>
              <Button
                label="View booking"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/bookings/[id]', params: { id: r.booking_id! } })
                }
              />
            </View>
          </Card>
        ) : r.status === 'open' && !r.offers.length ? (
          <Card style={styles.banner} testID="care-waiting">
            <IconBadge name="hourglass" tone="peach" />
            <View style={styles.flex}>
              <Text variant="bodyStrong">Waiting for offers</Text>
              <Text variant="caption" color="textMuted">
                Verified caretakers near {r.locality} can see your request.{' '}
                {closesLabel(r.offers_close_at, r.accepting_offers)}.
              </Text>
            </View>
          </Card>
        ) : r.status === 'open' ? (
          <Card style={styles.banner} testID="care-compare">
            <IconBadge name="git-compare" tone="lavender" />
            <View style={styles.flex}>
              <Text variant="bodyStrong">Compare and choose</Text>
              <Text variant="caption" color="textMuted">
                {closesLabel(r.offers_close_at, r.accepting_offers)}. You can book any offer until
                the start.
              </Text>
            </View>
          </Card>
        ) : (
          <Card style={styles.banner}>
            <IconBadge name="information-circle" tone="coral" />
            <Text variant="body" style={styles.flex}>
              {r.status === 'cancelled'
                ? 'You withdrew this request.'
                : 'This request ended without a booking. Post a new one any time.'}
            </Text>
          </Card>
        )}

        {live.length ? (
          <View style={styles.section}>
            <SectionHeader title="Offers" />
            {live.map((o) => (
              <OfferCard
                key={o.id}
                offer={o}
                request={r}
                busy={accept.isPending && accept.variables === o.id}
                onAccept={() => confirmAccept(o)}
              />
            ))}
            {accept.isError ? (
              <Text variant="body" color="error" accessibilityRole="alert">
                {errorMessage(accept.error)}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Your request" />
          <Card style={styles.list}>
            <ListRow icon="paw" tone="lavender" title={petsLabel(r.pets)} subtitle={t.label} />
            <ListRow
              icon="location"
              tone="coral"
              title={r.locality}
              subtitle={
                r.address ?? (r.area_name ? `${r.area_name} · pin shared after booking` : undefined)
              }
            />
            {r.notes ? (
              <ListRow icon="document-text" tone="peach" title="Notes" subtitle={r.notes} />
            ) : null}
          </Card>
        </View>

        {r.status === 'open' ? (
          <Button
            label="Withdraw request"
            icon="close-circle"
            variant="tertiary"
            fullWidth
            loading={cancel.isPending}
            onPress={() =>
              Alert.alert('Withdraw this request?', 'Pending offers will be declined.', [
                { text: 'Keep it', style: 'cancel' },
                { text: 'Withdraw', style: 'destructive', onPress: () => cancel.mutate() },
              ])
            }
            testID="care-cancel"
          />
        ) : null}
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xs },
  shrink: { flexShrink: 1 },
  section: { gap: spacing.md },
  list: { paddingVertical: spacing.sm, gap: spacing.xs },
  heroContent: { gap: spacing.md },
  pillRow: { flexDirection: 'row' },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  offer: { gap: spacing.md },
  offerHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  price: { alignItems: 'flex-end' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  home: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  quote: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.background },
});
