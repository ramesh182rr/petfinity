import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Linking, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import {
  Button,
  Card,
  HeroScreen,
  IconBadge,
  ListRow,
  SectionHeader,
  StatusPill,
  Text,
} from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import {
  cancelPreview,
  formatClock,
  formatShortDay,
  formatWeekday,
  formatWhen,
  PAYMENT_LABEL,
  policyLine,
  STATUS_INFO,
} from '@/features/bookings/format';
import { useBooking, useCancelBooking, usePayBooking } from '@/features/bookings/hooks';
import { Timeline } from '@/features/bookings/Timeline';
import { MyReviewCard } from '@/features/reviews/MyReviewCard';
import type { BookingDetail } from '@/features/bookings/types';
import { formatRupees } from '@/features/catalog/format';
import { HeroStats } from '@/features/discovery/DetailParts';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, spacing } from '@/theme';

function StatusBanner({ booking, isNew }: { booking: BookingDetail; isNew: boolean }) {
  const s = booking.status;
  if (s === 'pending_provider') {
    return (
      <Card style={styles.banner} testID="banner-pending">
        <IconBadge name="hourglass" tone="peach" />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{isNew ? 'Request sent' : 'Waiting for confirmation'}</Text>
          <Text variant="caption" color="textMuted">
            {booking.listing.name} has until{' '}
            {booking.response_deadline ? formatClock(booking.response_deadline) : 'soon'} to
            confirm. The time is held for you, and you pay nothing until it’s confirmed.
          </Text>
        </View>
      </Card>
    );
  }
  if (isNew && s === 'confirmed') {
    return (
      <Card style={styles.banner} testID="banner-confirmed">
        <IconBadge name="checkmark-circle" tone="sage" />
        <View style={styles.flex}>
          <Text variant="bodyStrong">You’re booked!</Text>
          <Text variant="caption" color="textMuted">
            {booking.pets.map((p) => p.name).join(', ')} is seen on {formatWhen(booking.start_at)}.
          </Text>
        </View>
      </Card>
    );
  }
  if (s === 'declined' || s === 'expired' || s === 'cancelled_by_provider') {
    const text =
      s === 'declined'
        ? `${booking.listing.name} couldn't take this request${booking.cancel_reason ? `: "${booking.cancel_reason}"` : '.'}`
        : s === 'expired'
          ? `${booking.listing.name} didn't confirm in time, so the request was released.`
          : `${booking.listing.name} cancelled this appointment${booking.cancel_reason ? `: "${booking.cancel_reason}"` : '.'}`;
    return (
      <Card style={styles.banner} testID="banner-unsuccessful">
        <IconBadge name="information-circle" tone="coral" />
        <View style={styles.flex}>
          <Text variant="body">{text} You weren’t charged.</Text>
          <Button
            label="Find another time"
            variant="secondary"
            onPress={() =>
              router.push(
                booking.listing.kind === 'clinic'
                  ? { pathname: '/discover/clinic/[id]', params: { id: booking.listing.id } }
                  : { pathname: '/discover/vet/[id]', params: { id: booking.listing.id } },
              )
            }
          />
        </View>
      </Card>
    );
  }
  // Every other status still gets a summary card: the hero overlap expects a card first.
  const info = STATUS_INFO[s];
  const outcome =
    outcomeText(booking) ??
    (s === 'confirmed' ? `See you on ${formatWhen(booking.start_at)}.` : null);
  return (
    <Card style={styles.banner} testID="banner-status">
      <IconBadge name={info.icon} tone={info.badge} />
      <View style={styles.flex}>
        <Text variant="bodyStrong">{info.label}</Text>
        {outcome ? (
          <Text variant="caption" color="textMuted">
            {outcome}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

function outcomeText(booking: BookingDetail): string | null {
  switch (booking.cancellation_outcome) {
    case 'full_refund':
      return 'Cancelled in time. Your mock payment was refunded in full.';
    case 'late_half_refund':
      return 'Cancelled less than 48 hours before, so half of a payment is refunded.';
    case 'late_no_refund':
      return 'Cancelled less than 2 hours before, so this counts as a late cancellation.';
    case 'not_charged':
      return 'Cancelled. Nothing was charged.';
    default:
      break;
  }
  if (booking.status === 'completed')
    return 'Hope your visit went well. Thanks for choosing Petfinity.';
  if (booking.status === 'in_progress') return 'You’re checked in.';
  if (booking.status === 'no_show') return 'The clinic marked this visit as missed.';
  return null;
}

function PaymentCard({ booking }: { booking: BookingDetail }) {
  const pay = usePayBooking(booking.id);
  const canPay = booking.allowed_actions.includes('pay');
  const canChooseVisit = booking.allowed_actions.includes('pay_at_visit');
  return (
    <Card style={styles.section} testID="payment-card">
      <View style={styles.payHead}>
        <IconBadge name="wallet" tone="lavender" />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{formatRupees(booking.amount_minor)}</Text>
          <Text variant="caption" color="textMuted" testID="payment-status">
            {PAYMENT_LABEL[booking.payment_status]}
          </Text>
        </View>
        <StatusPill label="Mock" tone="warning" />
      </View>
      {canPay || canChooseVisit ? (
        <>
          <View style={styles.buttonRow}>
            {canPay ? (
              <Button
                label="Pay now"
                icon="card"
                loading={pay.isPending && pay.variables === 'pay_now'}
                onPress={() => pay.mutate('pay_now')}
                style={styles.flexButton}
                testID="pay-now"
              />
            ) : null}
            {canChooseVisit ? (
              <Button
                label="Pay at visit"
                icon="storefront"
                variant="secondary"
                loading={pay.isPending && pay.variables === 'pay_at_visit'}
                onPress={() => pay.mutate('pay_at_visit')}
                style={styles.flexButton}
                testID="pay-at-visit"
              />
            ) : null}
          </View>
          <Text variant="caption" color="textMuted">
            Payments are simulated while Petfinity is in development. No money moves.
          </Text>
        </>
      ) : null}
      {pay.isError ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {errorMessage(pay.error)}
        </Text>
      ) : null}
    </Card>
  );
}

export default function BookingDetailScreen() {
  const params = useLocalSearchParams<{ id: string; new?: string }>();
  const booking = useBooking(params.id);
  const cancel = useCancelBooking(params.id);
  useRefreshOnFocus(booking.refetch);

  if (booking.isPending) return <LoadingState message="Loading appointment…" />;
  if (booking.isError) {
    return (
      <ErrorState
        onRetry={() => void booking.refetch()}
        requestId={isApiError(booking.error) ? booking.error.requestId : null}
      />
    );
  }

  const b = booking.data;
  const status = STATUS_INFO[b.status];
  const canCancel = b.allowed_actions.includes('cancel');
  const canReschedule = b.allowed_actions.includes('reschedule');
  const showPayment =
    ['confirmed', 'in_progress', 'completed'].includes(b.status) ||
    b.payment_status === 'refunded' ||
    b.payment_status === 'not_refunded';
  const homeVisit = b.service_mode === 'home_visit';

  const confirmCancel = () =>
    Alert.alert('Cancel this appointment?', cancelPreview(b), [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel appointment', style: 'destructive', onPress: () => cancel.mutate(undefined) },
    ]);

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="booking-detail"
        underHeader
        eyebrow={
          b.booking_type === 'care' ? 'Care booking' : homeVisit ? 'Home visit' : 'Appointment'
        }
        title={b.service_title}
        subtitle={b.listing.name}
        overlap
        heroContent={
          <View style={styles.heroContent}>
            <View style={styles.heroPill}>
              <StatusPill label={status.label} tone="onDark" testID="booking-status" />
            </View>
            <HeroStats
              items={[
                { value: formatShortDay(b.start_at), label: formatWeekday(b.start_at) },
                { value: formatClock(b.start_at), label: 'Time' },
                { value: formatRupees(b.amount_minor), label: 'Price' },
              ]}
            />
          </View>
        }
      >
        <StatusBanner booking={b} isNew={params.new === '1'} />

        {b.review || b.allowed_actions.includes('review') ? (
          <View style={styles.section}>
            <SectionHeader title="Your review" />
            <MyReviewCard
              bookingId={b.id}
              review={b.review}
              canReview={b.allowed_actions.includes('review')}
              listingName={b.listing.name}
            />
          </View>
        ) : null}

        {showPayment ? (
          <View style={styles.section}>
            <SectionHeader title="Payment" />
            <PaymentCard booking={b} />
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Details" />
          <Card style={styles.list}>
            <ListRow
              icon="paw"
              tone="lavender"
              title={b.pets.map((p) => p.name).join(', ')}
              subtitle={b.pets.map((p) => p.breed ?? p.species.replace('_', ' ')).join(', ')}
            />
            <ListRow
              icon={b.listing.kind === 'clinic' ? 'medkit' : 'home'}
              tone="sage"
              title={b.listing.name}
              subtitle={b.listing.locality ?? undefined}
              onPress={
                b.listing.kind === 'caretaker' // caretaker profiles open in 3.4
                  ? undefined
                  : () =>
                      router.push(
                        b.listing.kind === 'clinic'
                          ? { pathname: '/discover/clinic/[id]', params: { id: b.listing.id } }
                          : { pathname: '/discover/vet/[id]', params: { id: b.listing.id } },
                      )
              }
            />
            {b.visit_address ? (
              <ListRow
                icon="location"
                tone="coral"
                title="Visit address"
                subtitle={b.visit_address}
              />
            ) : null}
            {b.owner_notes ? (
              <ListRow
                icon="document-text"
                tone="peach"
                title="Your notes"
                subtitle={b.owner_notes}
              />
            ) : null}
          </Card>
          {b.listing.kind === 'clinic' && ['confirmed', 'in_progress'].includes(b.status) ? (
            <Button
              label="Get directions"
              icon="navigate"
              variant="secondary"
              fullWidth
              onPress={() =>
                void Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    [b.listing.name, b.listing.locality].filter(Boolean).join(', '),
                  )}`,
                )
              }
            />
          ) : null}
        </View>

        {canCancel || canReschedule ? (
          <View style={styles.section}>
            <SectionHeader title="Changes" />
            <Card style={styles.section}>
              <View style={styles.policy}>
                <Ionicons name="shield-checkmark" size={18} color={colors.success} />
                <Text variant="caption" color="textMuted" style={styles.flex} testID="policy-line">
                  {policyLine(b.policy.free_cancellation_until)}. Later cancellations aren’t
                  refunded.
                </Text>
              </View>
              <View style={styles.buttonRow}>
                {canReschedule ? (
                  <Button
                    label="Reschedule"
                    icon="calendar"
                    variant="secondary"
                    onPress={() =>
                      router.push({ pathname: '/bookings/[id]/reschedule', params: { id: b.id } })
                    }
                    style={styles.flexButton}
                    testID="reschedule"
                  />
                ) : null}
                {canCancel ? (
                  <Button
                    label="Cancel"
                    icon="close-circle"
                    variant="tertiary"
                    loading={cancel.isPending}
                    onPress={confirmCancel}
                    style={styles.flexButton}
                    testID="cancel"
                  />
                ) : null}
              </View>
              {cancel.isError ? (
                <Text variant="caption" color="error" accessibilityRole="alert">
                  {errorMessage(cancel.error)}
                </Text>
              ) : null}
            </Card>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Timeline" />
          <Timeline events={b.events} />
        </View>
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xs },
  heroContent: { gap: spacing.md },
  heroPill: { flexDirection: 'row' },
  section: { gap: spacing.md },
  list: { paddingVertical: spacing.sm, gap: spacing.xs },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  payHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  buttonRow: { flexDirection: 'row', gap: spacing.md },
  flexButton: { flex: 1 },
  policy: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
