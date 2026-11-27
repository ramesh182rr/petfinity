import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import {
  Button,
  Card,
  Chip,
  HeroScreen,
  IconBadge,
  ListRow,
  SectionHeader,
  StatusPill,
  Text,
  TextField,
} from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import {
  formatClock,
  formatShortDay,
  formatWeekday,
  PROVIDER_REASONS,
  replyBy,
  STATUS_INFO,
} from '@/features/bookings/format';
import { useBooking, useProviderAction } from '@/features/bookings/hooks';
import { Timeline } from '@/features/bookings/Timeline';
import type { BookingDetail } from '@/features/bookings/types';
import { formatRupees } from '@/features/catalog/format';
import { HeroStats } from '@/features/discovery/DetailParts';
import { useRefreshOnFocus } from '@/lib/useRefreshOnFocus';
import { transparentHeader } from '@/navigation/headerOptions';
import { spacing } from '@/theme';

type ReasonMode = 'decline' | 'cancel';

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const PAYMENT_FOR_PROVIDER: Record<BookingDetail['payment_status'], string> = {
  not_due: 'Nothing is charged until you confirm',
  unpaid: 'Not paid online: collect at the visit',
  pay_at_visit: 'Collect payment at the visit',
  paid: 'Paid online (mock)',
  refunded: 'Refunded to the pet parent (mock)',
  not_refunded: 'Late cancellation: not refunded (mock)',
};

function ReasonPanel({
  mode,
  busy,
  onSubmit,
  onBack,
}: {
  mode: ReasonMode;
  busy: boolean;
  onSubmit: (reason: string) => void;
  onBack: () => void;
}) {
  const [reason, setReason] = useState('');
  const presets: readonly string[] = PROVIDER_REASONS[mode];
  const valid = reason.trim().length >= 3;
  return (
    <View style={styles.reason} testID="reason-panel">
      <Text variant="bodyStrong">
        {mode === 'decline' ? 'Why can’t you take this request?' : 'Why are you cancelling?'}
      </Text>
      <Text variant="caption" color="textMuted">
        The pet parent sees this message.{' '}
        {mode === 'cancel' ? 'They’re refunded in full if they paid.' : 'They aren’t charged.'}
      </Text>
      <View style={styles.chips}>
        {presets.map((preset) => (
          <Chip
            key={preset}
            label={preset}
            selected={reason === preset}
            onPress={() => setReason(preset)}
          />
        ))}
      </View>
      <TextField
        testID="reason-input"
        label="Or write your own"
        value={reason}
        onChangeText={setReason}
        maxLength={300}
        multiline
      />
      <View style={styles.row}>
        <Button
          label="Back"
          variant="tertiary"
          onPress={onBack}
          style={styles.flexButton}
          testID="reason-back"
        />
        <Button
          label={mode === 'decline' ? 'Decline' : 'Cancel visit'}
          disabled={!valid}
          loading={busy}
          onPress={() => onSubmit(reason.trim())}
          style={styles.flexButton}
          testID="reason-submit"
        />
      </View>
    </View>
  );
}

/** What to do next, by status: answer, check in, complete, or a summary. */
function ActionCard({ booking }: { booking: BookingDetail }) {
  const act = useProviderAction(booking.id);
  const [reasonMode, setReasonMode] = useState<ReasonMode | null>(null);
  const can = (a: BookingDetail['allowed_actions'][number]) => booking.allowed_actions.includes(a);
  const info = STATUS_INFO[booking.status];
  const run = (action: Parameters<typeof act.mutate>[0]['action'], reason?: string) =>
    act.mutate({ action, reason }, { onSuccess: () => setReasonMode(null) });
  const busy = (a: string) => act.isPending && act.variables?.action === a;

  let title: string = info.label;
  let body: string | null = null;
  if (booking.status === 'pending_provider') {
    title = 'New request';
    body = booking.response_deadline
      ? `${replyBy(booking.response_deadline)}. If you don’t answer, it expires and the time is released.`
      : null;
  } else if (booking.status === 'confirmed') {
    body = can('check_in')
      ? 'Check the pet in when they arrive.'
      : `Check-in opens an hour before the start (${formatClock(
          new Date(new Date(booking.start_at).getTime() - 3_600_000).toISOString(),
        )}).`;
  } else if (booking.status === 'in_progress') {
    body = 'Mark the visit completed when you’re done. The pet parent can then leave a review.';
  } else if (booking.cancel_reason) {
    body = `Reason: ${booking.cancel_reason}`;
  } else {
    body =
      {
        completed: 'Visit done. The pet parent can now leave a review.',
        no_show: 'Marked as missed. The pet parent can ask Petfinity to review this.',
        expired: 'You didn’t answer in time, so the request was released.',
        cancelled_by_owner: 'The pet parent cancelled.',
        cancelled_by_admin: 'Cancelled by Petfinity.',
        disputed: 'Petfinity is reviewing this booking.',
      }[booking.status as string] ?? null;
  }

  return (
    <Card style={styles.section} testID="provider-actions">
      <View style={styles.head}>
        <IconBadge name={info.icon} tone={info.badge} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{title}</Text>
          {body ? (
            <Text variant="caption" color="textMuted">
              {body}
            </Text>
          ) : null}
        </View>
      </View>

      {reasonMode ? (
        <ReasonPanel
          mode={reasonMode}
          busy={act.isPending}
          onBack={() => setReasonMode(null)}
          onSubmit={(reason) => run(reasonMode, reason)}
        />
      ) : (
        <>
          {can('confirm') || can('decline') ? (
            <View style={styles.row}>
              {can('decline') ? (
                <Button
                  label="Decline"
                  variant="secondary"
                  onPress={() => setReasonMode('decline')}
                  style={styles.flexButton}
                  testID="decline"
                />
              ) : null}
              {can('confirm') ? (
                <Button
                  label="Confirm"
                  icon="checkmark-circle"
                  loading={busy('confirm')}
                  onPress={() => run('confirm')}
                  style={styles.flexButton}
                  testID="confirm"
                />
              ) : null}
            </View>
          ) : null}
          {can('check_in') ? (
            <Button
              label="Check in"
              icon="enter"
              size="lg"
              fullWidth
              loading={busy('check-in')}
              onPress={() => run('check-in')}
              testID="check-in"
            />
          ) : null}
          {can('complete') ? (
            <Button
              label="Mark completed"
              icon="ribbon"
              size="lg"
              fullWidth
              loading={busy('complete')}
              onPress={() => run('complete')}
              testID="complete"
            />
          ) : null}
          {can('no_show') || can('cancel') ? (
            <View style={styles.row}>
              {can('no_show') ? (
                <Button
                  label="Didn’t come"
                  icon="alert-circle"
                  variant="secondary"
                  loading={busy('no-show')}
                  onPress={() => run('no-show')}
                  style={styles.flexButton}
                  testID="no-show"
                />
              ) : null}
              {can('cancel') ? (
                <Button
                  label="Cancel"
                  icon="close-circle"
                  variant="tertiary"
                  onPress={() => setReasonMode('cancel')}
                  style={styles.flexButton}
                  testID="provider-cancel"
                />
              ) : null}
            </View>
          ) : null}
        </>
      )}
      {act.isError ? (
        <Text variant="caption" color="error" accessibilityRole="alert" testID="action-error">
          {errorMessage(act.error)}
        </Text>
      ) : null}
    </Card>
  );
}

export default function ProviderBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const booking = useBooking(id);
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
  const homeVisit = b.service_mode === 'home_visit';
  const label = b.status === 'pending_provider' ? 'New request' : STATUS_INFO[b.status].label;
  const petNames = b.pets.map((p) => p.name).join(', ');

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="provider-booking"
        underHeader
        eyebrow={homeVisit ? 'Home visit' : 'Clinic appointment'}
        title={petNames || b.service_title}
        subtitle={`${b.service_title} · ${b.owner_name ?? 'Pet parent'}`}
        overlap
        heroContent={
          <View style={styles.heroContent}>
            <View style={styles.pillRow}>
              <StatusPill label={label} tone="onDark" testID="provider-booking-status" />
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
        <ActionCard booking={b} />

        <View style={styles.section}>
          <SectionHeader title="Patient" />
          <Card style={styles.list}>
            {b.pets.map((p) => (
              <ListRow
                key={p.id}
                icon="paw"
                tone="lavender"
                title={p.name}
                subtitle={[capitalize(p.species.replace('_', ' ')), p.breed]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
            <ListRow
              icon="person"
              tone="sage"
              title={b.owner_name ?? 'Pet parent'}
              subtitle="Pet parent"
            />
            {b.owner_notes ? (
              <ListRow icon="document-text" tone="peach" title="Notes" subtitle={b.owner_notes} />
            ) : null}
            {homeVisit ? (
              <ListRow
                icon="location"
                tone="coral"
                title="Visit address"
                subtitle={b.visit_address ?? 'Shared with you once you confirm the request.'}
              />
            ) : null}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Payment" />
          <Card style={styles.head}>
            <IconBadge name="wallet" tone="coral" />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{formatRupees(b.amount_minor)}</Text>
              <Text variant="caption" color="textMuted" testID="provider-payment">
                {b.payment_status === 'unpaid' &&
                !['confirmed', 'in_progress', 'completed', 'no_show'].includes(b.status)
                  ? 'Nothing to collect'
                  : PAYMENT_FOR_PROVIDER[b.payment_status]}
              </Text>
            </View>
            <StatusPill label="Mock" tone="warning" />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Timeline" />
          <Timeline events={b.events} showActor />
        </View>
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xxs },
  section: { gap: spacing.md },
  list: { paddingVertical: spacing.sm, gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  flexButton: { flex: 1 },
  heroContent: { gap: spacing.md },
  pillRow: { flexDirection: 'row' },
  reason: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
