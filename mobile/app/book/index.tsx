import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { errorMessage } from '@/features/auth/errorMessage';
import { EmptyState, ErrorState, LoadingState } from '@/components/states/StateViews';
import {
  Button,
  Card,
  FormSection,
  HeroScreen,
  ListRow,
  StatusPill,
  Text,
  TextField,
} from '@/components/ui';
import { formatDuration, formatRupees } from '@/features/catalog/format';
import { formatClock, formatDay, newIdempotencyKey } from '@/features/bookings/format';
import { useCreateBooking } from '@/features/bookings/hooks';
import { HeroStats } from '@/features/discovery/DetailParts';
import { useClinicListing, useVetListing } from '@/features/discovery/hooks';
import { useDiscoveryStore } from '@/features/discovery/store';
import type { ListingKind, PublicService } from '@/features/discovery/types';
import { speciesLabel } from '@/features/pets/format';
import { usePets } from '@/features/pets/hooks';
import { PetAvatar } from '@/features/pets/PetAvatar';
import type { Pet } from '@/features/pets/types';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, radius, spacing } from '@/theme';

const FREE_CANCEL_HOURS = 2;

/** Services list dog, cat and other: every other species books as "other". */
const offeredFor = (service: PublicService, pet: Pet) =>
  service.species.includes(pet.species === 'dog' || pet.species === 'cat' ? pet.species : 'other');

function useListing(kind: ListingKind, id: string) {
  const origin = useDiscoveryStore((s) => s.origin);
  const clinic = useClinicListing(kind === 'clinic' ? id : '', origin);
  const vet = useVetListing(kind === 'vet' ? id : '', origin);
  return kind === 'clinic' ? clinic : vet;
}

export default function BookReviewScreen() {
  const params = useLocalSearchParams<{
    kind: string;
    listingId: string;
    serviceId: string;
    start: string;
  }>();
  const kind: ListingKind = params.kind === 'vet' ? 'vet' : 'clinic';
  const listing = useListing(kind, params.listingId);
  const pets = usePets();
  const create = useCreateBooking();
  // One key per attempt on this screen: a double tap or a retry can't book twice.
  const key = useRef(newIdempotencyKey());
  const [petId, setPetId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [addressError, setAddressError] = useState<string | null>(null);

  if (listing.isPending || pets.isPending)
    return <LoadingState message="Preparing your booking…" />;
  if (listing.isError || pets.isError) {
    const error = listing.error ?? pets.error;
    return (
      <ErrorState
        onRetry={() => {
          void listing.refetch();
          void pets.refetch();
        }}
        requestId={isApiError(error) ? error.requestId : null}
      />
    );
  }

  const data = listing.data;
  const name = 'name' in data ? data.name : data.display_name;
  const service = data.services.find((s) => s.id === params.serviceId);
  if (!service) {
    return (
      <EmptyState
        icon="pricetags-outline"
        tone="peach"
        title="This service isn't available any more"
        message="Go back and pick another service or time."
        action={{ label: 'Go back', onPress: () => router.back() }}
      />
    );
  }

  const homeVisit = service.service_mode === 'home_visit';
  const instant = service.confirmation_mode === 'instant';
  const eligible = pets.data.filter((p) => offeredFor(service, p));
  const selectedPet =
    pets.data.find((p) => p.id === petId) ?? (eligible.length === 1 ? eligible[0] : undefined);
  const freeUntil = new Date(
    new Date(params.start).getTime() - FREE_CANCEL_HOURS * 3_600_000,
  ).toISOString();
  const conflict = isApiError(create.error) && create.error.code === 'slot_unavailable';

  const submit = () => {
    if (!selectedPet) return;
    if (homeVisit && address.trim().length < 5) {
      setAddressError('Add the full address for the home visit.');
      return;
    }
    setAddressError(null);
    create.mutate(
      {
        key: key.current,
        body: {
          listing_kind: kind,
          listing_id: params.listingId,
          service_id: service.id,
          start_at: params.start,
          pet_ids: [selectedPet.id],
          owner_notes: notes.trim() || null,
          visit_address: homeVisit ? address.trim() : null,
        },
      },
      {
        onSuccess: (booking) =>
          router.replace({ pathname: '/bookings/[id]', params: { id: booking.id, new: '1' } }),
      },
    );
  };

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="book-review"
        underHeader
        eyebrow={homeVisit ? 'Book a home visit' : 'Book an appointment'}
        title={service.title}
        subtitle={`${name} · ${formatDuration(service.duration_minutes)}`}
        overlap
        heroContent={
          <HeroStats
            items={[
              { value: formatDay(params.start), label: 'Date' },
              { value: formatClock(params.start), label: 'Time' },
              { value: formatRupees(service.price_minor), label: 'Price' },
            ]}
          />
        }
      >
        <FormSection title="Who is it for?" note="One pet per appointment.">
          {pets.data.length ? (
            <View style={styles.pets}>
              {pets.data.map((pet) => {
                const ok = offeredFor(service, pet);
                const selected = selectedPet?.id === pet.id;
                return (
                  <Pressable
                    key={pet.id}
                    disabled={!ok}
                    onPress={() => setPetId(pet.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, disabled: !ok }}
                    accessibilityLabel={`${pet.name}, ${speciesLabel(pet)}`}
                    testID={`book-pet-${pet.id}`}
                    style={[styles.pet, selected && styles.petSelected, !ok && styles.petDisabled]}
                  >
                    <PetAvatar pet={pet} size={44} />
                    <View style={styles.flex}>
                      <Text variant="bodyStrong">{pet.name}</Text>
                      <Text variant="caption" color="textMuted">
                        {ok ? speciesLabel(pet) : `${speciesLabel(pet)} · not offered here`}
                      </Text>
                    </View>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={selected ? colors.primary : colors.borderStrong}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <EmptyState
              compact
              icon="paw"
              tone="lavender"
              title="Add your pet first"
              message="Vets need to know who they're seeing."
              action={{ label: 'Add a pet', onPress: () => router.push('/pets/new') }}
            />
          )}
        </FormSection>

        {homeVisit ? (
          <FormSection
            title="Visit address"
            note="Shared with the vet only after they accept your request."
          >
            <TextField
              testID="book-address"
              label="Address"
              value={address}
              onChangeText={setAddress}
              multiline
              maxLength={300}
              placeholder="House / flat, street, area"
              error={addressError ?? undefined}
            />
          </FormSection>
        ) : null}

        <FormSection title="Anything the vet should know?">
          <TextField
            testID="book-notes"
            label="Notes (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            maxLength={500}
            placeholder="Symptoms, since when, any medicines"
          />
        </FormSection>

        <Card style={styles.rules}>
          <ListRow
            icon={instant ? 'flash' : 'hourglass'}
            tone={instant ? 'sage' : 'peach'}
            title={instant ? 'Confirmed instantly' : 'Confirmed by the vet within 2 hours'}
            subtitle={
              instant
                ? 'The time is yours as soon as you book.'
                : "The time is held for you while they check. If they don't answer, you're not charged."
            }
          />
          <ListRow
            icon="shield-checkmark"
            tone="lavender"
            title={`Free cancellation until ${formatClock(freeUntil)}`}
            subtitle={`On ${formatDay(freeUntil)}. Cancelling later than ${FREE_CANCEL_HOURS} hours before isn’t refunded.`}
          />
          <ListRow
            icon="wallet"
            tone="coral"
            title="Pay now or at the visit"
            subtitle="You choose after the booking is confirmed."
          />
        </Card>

        <Card style={styles.total} testID="book-total">
          <View style={styles.flex}>
            <Text variant="caption" color="textMuted">
              Total
            </Text>
            <Text variant="heading" color="primary">
              {formatRupees(service.price_minor)}
            </Text>
          </View>
          <StatusPill label="Mock payment · not charged" tone="warning" />
        </Card>

        {conflict ? (
          <Card style={styles.conflict} testID="slot-conflict">
            <Text variant="bodyStrong">That time was just taken</Text>
            <Text variant="body" color="textMuted">
              Someone booked it a moment ago. Pick another time; nothing was charged.
            </Text>
            <Button label="Pick another time" variant="secondary" onPress={() => router.back()} />
          </Card>
        ) : create.isError ? (
          <Text variant="body" color="error" accessibilityRole="alert" testID="book-error">
            {errorMessage(create.error)}
          </Text>
        ) : null}

        <Button
          testID="book-submit"
          label={instant ? 'Confirm appointment' : 'Send request'}
          icon={instant ? 'checkmark-circle' : 'paper-plane'}
          size="lg"
          fullWidth
          disabled={!selectedPet || conflict}
          loading={create.isPending}
          onPress={submit}
        />
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.xxs },
  pets: { gap: spacing.sm },
  pet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  petSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  petDisabled: { opacity: 0.5 },
  rules: { gap: spacing.sm },
  total: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  conflict: { gap: spacing.sm },
});
