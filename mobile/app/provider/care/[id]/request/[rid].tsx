import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

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
  TextField,
} from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { CARE_LABEL, careWhen, closesLabel, unitsLabel } from '@/features/care/format';
import { useCareFeedItem, useSendOffer, useWithdrawOffer } from '@/features/care/hooks';
import type { CarePet, CaretakerRequest } from '@/features/care/types';
import { formatRupees, parseRupees } from '@/features/catalog/format';
import { HeroStats } from '@/features/discovery/DetailParts';
import { transparentHeader } from '@/navigation/headerOptions';
import { spacing } from '@/theme';

import { OFFER_STATUS } from '../requests';

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function petLine(p: CarePet): string {
  return [
    p.breed ?? cap(p.species.replace('_', ' ')),
    p.age_years != null ? `${p.age_years} yr${p.age_years === 1 ? '' : 's'}` : null,
    p.weight_kg != null ? `${p.weight_kg} kg` : null,
    p.sex !== 'unknown' ? p.sex : null,
    p.neutered ? 'neutered' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function OfferComposer({ profileId, r }: { profileId: string; r: CaretakerRequest }) {
  const send = useSendOffer(profileId, r.id);
  const withdraw = useWithdrawOffer(profileId, r.id);
  const pending = r.my_offer?.status === 'pending';
  const [price, setPrice] = useState(() =>
    String(((r.my_offer?.price_minor ?? r.suggested_price_minor ?? 0) as number) / 100 || ''),
  );
  const [message, setMessage] = useState(r.my_offer?.message ?? '');
  const [error, setError] = useState<string | null>(null);
  const canSend = pending || (r.accepting_offers && r.status === 'open');

  if (!canSend) {
    return (
      <Card style={styles.card}>
        <Text variant="body" color="textMuted">
          This request isn’t taking new offers any more.
        </Text>
      </Card>
    );
  }
  const submit = () => {
    const minor = parseRupees(price);
    if (minor === null || minor <= 0) {
      setError('Enter your total price in rupees.');
      return;
    }
    setError(null);
    send.mutate({ price_minor: minor, message: message.trim() || null });
  };
  return (
    <Card style={styles.card} testID="offer-composer">
      <TextField
        label={`Your total price for ${unitsLabel(r.units, r.unit)}`}
        value={price}
        onChangeText={(v) => setPrice(v.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        maxLength={7}
        prefix={<Text variant="bodyStrong">₹</Text>}
        hint={
          r.suggested_price_minor != null
            ? `Your starting rate works out to ${formatRupees(r.suggested_price_minor)}.`
            : undefined
        }
        error={error ?? undefined}
        testID="offer-price"
      />
      <TextField
        label="Message to the pet parent (optional)"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={500}
        placeholder="Your experience with pets like theirs, routine, anything you'd like to check"
        testID="offer-message"
      />
      {send.isError || withdraw.isError ? (
        <Text variant="caption" color="error" accessibilityRole="alert">
          {errorMessage(send.error ?? withdraw.error)}
        </Text>
      ) : null}
      <View style={styles.row}>
        {pending ? (
          <Button
            label="Withdraw"
            variant="tertiary"
            loading={withdraw.isPending}
            onPress={() =>
              Alert.alert('Withdraw your offer?', undefined, [
                { text: 'Keep it', style: 'cancel' },
                {
                  text: 'Withdraw',
                  style: 'destructive',
                  onPress: () => withdraw.mutate(undefined, { onSuccess: () => router.back() }),
                },
              ])
            }
            style={styles.flexButton}
            testID="offer-withdraw"
          />
        ) : null}
        <Button
          label={pending ? 'Update offer' : 'Send offer'}
          icon="paper-plane"
          loading={send.isPending}
          onPress={submit}
          style={styles.flexButton}
          testID="offer-send"
        />
      </View>
      <Text variant="caption" color="textMuted" align="center">
        If they accept, it’s booked straight away and you get their address.
      </Text>
    </Card>
  );
}

/** Caretaker: one request, and your offer (3.5). */
export default function CaretakerRequestScreen() {
  const { id, rid } = useLocalSearchParams<{ id: string; rid: string }>();
  const item = useCareFeedItem(id, rid);
  if (item.isPending) return <LoadingState message="Loading request…" />;
  if (item.isError) {
    return (
      <ErrorState
        title={
          isApiError(item.error) && item.error.status === 404
            ? 'Request no longer available'
            : undefined
        }
        onRetry={() => void item.refetch()}
        requestId={isApiError(item.error) ? item.error.requestId : null}
      />
    );
  }
  const r = item.data;
  const t = CARE_LABEL[r.care_type];
  const offer = r.my_offer ? OFFER_STATUS[r.my_offer.status] : null;

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="caretaker-request"
        underHeader
        eyebrow={`${t.label} request`}
        title={`${r.locality}`}
        subtitle={careWhen(r.start_at, r.end_at)}
        overlap
        heroContent={
          <HeroStats
            items={[
              { value: unitsLabel(r.units, r.unit), label: 'Care' },
              { value: `${r.distance_km} km`, label: 'Away' },
              {
                value: r.budget_minor != null ? formatRupees(r.budget_minor) : '–',
                label: 'Budget',
              },
            ]}
          />
        }
      >
        {r.booking_id ? (
          <Card style={styles.banner} testID="offer-won">
            <IconBadge name="trophy" tone="sage" />
            <View style={styles.flex}>
              <Text variant="bodyStrong">They chose you</Text>
              <Text variant="caption" color="textMuted">
                The booking has their address and name.
              </Text>
              <Button
                label="Open booking"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: '/provider/booking/[id]', params: { id: r.booking_id! } })
                }
              />
            </View>
          </Card>
        ) : (
          <Card style={styles.banner}>
            <IconBadge name="time" tone="peach" />
            <View style={styles.flex}>
              <Text variant="bodyStrong">
                {r.my_offer
                  ? `You offered ${formatRupees(r.my_offer.price_minor)}`
                  : `${r.offer_count} of 5 offers so far`}
              </Text>
              <Text variant="caption" color="textMuted">
                {closesLabel(r.offers_close_at, r.accepting_offers)}.
              </Text>
            </View>
            {offer ? <StatusPill label={offer.label} tone={offer.tone} /> : null}
          </Card>
        )}

        <View style={styles.section}>
          <SectionHeader title={r.pets.length === 1 ? 'The pet' : `The pets (${r.pets.length})`} />
          <Card style={styles.list}>
            {r.pets.map((p) => (
              <ListRow
                key={p.id}
                icon="paw"
                tone="lavender"
                title={p.name}
                subtitle={[petLine(p), p.temperament].filter(Boolean).join('\n')}
              />
            ))}
            {r.notes ? (
              <ListRow icon="document-text" tone="peach" title="Notes" subtitle={r.notes} />
            ) : null}
          </Card>
        </View>

        {!r.booking_id ? (
          <View style={styles.section}>
            <SectionHeader
              title={r.my_offer?.status === 'pending' ? 'Your offer' : 'Make an offer'}
            />
            <OfferComposer profileId={id} r={r} />
          </View>
        ) : null}
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xs },
  section: { gap: spacing.md },
  list: { paddingVertical: spacing.sm, gap: spacing.xs },
  card: { gap: spacing.md },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  flexButton: { flex: 1 },
});
