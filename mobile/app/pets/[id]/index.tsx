import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import {
  Button,
  Card,
  Decor,
  InfoRow,
  SectionHeader,
  StatTile,
  StatusPill,
  Text,
} from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { ageLabel, formatDate, speciesLabel } from '@/features/pets/format';
import { useDeletePet, usePet, useRemovePetPhoto, useUploadPetPhoto } from '@/features/pets/hooks';
import { pickPetPhoto } from '@/features/pets/imagePicking';
import { PetAvatar } from '@/features/pets/PetAvatar';
import { transparentHeader } from '@/navigation/headerOptions';
import { colors, elevation, gradients, palette, radius, spacing } from '@/theme';

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const pet = usePet(id);
  const upload = useUploadPetPhoto(id);
  const removePhoto = useRemovePetPhoto(id);
  const remove = useDeletePet();

  if (pet.isPending) return <LoadingState message="Loading pet…" />;
  if (pet.isError || !pet.data) {
    return (
      <ErrorState
        title={isApiError(pet.error) && pet.error.status === 404 ? 'Pet not found' : undefined}
        onRetry={() => void pet.refetch()}
        requestId={isApiError(pet.error) ? pet.error.requestId : null}
      />
    );
  }
  const p = pet.data;

  const changePhoto = async () => {
    try {
      const image = await pickPetPhoto();
      if (image) upload.mutate(image);
    } catch {
      Alert.alert('Photo not added', "We couldn't open that photo. Please try another one.");
    }
  };

  const confirmDelete = () =>
    Alert.alert(`Remove ${p.name}?`, "This deletes the profile and photo. This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => remove.mutate(p.id, { onSuccess: () => router.back() }),
      },
    ]);

  const sex = p.sex === 'unknown' ? '—' : p.sex === 'male' ? 'Male' : 'Female';
  const hasHealth = [
    p.temperament,
    p.dietary_notes,
    p.allergies,
    p.known_conditions,
    p.medications,
  ].some(Boolean);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="pet-detail-screen"
    >
      <Stack.Screen options={transparentHeader} />
      <LinearGradient
        colors={gradients.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 56 }]}
      >
        <Decor
          bubbles={[
            { size: 200, color: palette.plum300, top: -70, left: -60, opacity: 0.2 },
            { size: 110, color: palette.coral400, top: 40, right: -30, opacity: 0.18 },
          ]}
        />
        <View style={styles.avatarRing}>
          <PetAvatar pet={p} size={112} />
        </View>
        <Text variant="display" color="textOnPrimary" align="center">
          {p.name}
        </Text>
        <StatusPill tone="onDark" label={[speciesLabel(p), p.breed].filter(Boolean).join(' · ')} />
      </LinearGradient>

      <View style={styles.stats}>
        <StatTile label="Age" value={ageLabel(p) ?? '—'} tone="lavender" />
        <StatTile
          label="Weight"
          value={p.weight_kg ? `${Number(p.weight_kg)} kg` : '—'}
          tone="sage"
        />
        <StatTile label="Sex" value={sex} tone="coral" />
      </View>

      <View style={styles.body}>
        <View style={styles.photoActions}>
          <Button
            testID="change-photo"
            variant="secondary"
            icon="camera-outline"
            label={p.photo_url ? 'Change photo' : 'Add photo'}
            loading={upload.isPending}
            onPress={() => void changePhoto()}
            style={styles.flexButton}
          />
          {p.photo_url ? (
            <Button
              variant="secondary"
              icon="trash-outline"
              label="Remove"
              loading={removePhoto.isPending}
              onPress={() => removePhoto.mutate()}
              style={styles.flexButton}
            />
          ) : null}
        </View>
        {upload.isError ? (
          <Text variant="caption" color="error" accessibilityRole="alert" align="center">
            {upload.error instanceof Error && !isApiError(upload.error)
              ? "The photo didn't upload. Check your connection and try again."
              : errorMessage(upload.error)}
          </Text>
        ) : null}

        <Card style={styles.card}>
          <SectionHeader title="About" />
          <InfoRow
            icon="calendar"
            tone="lavender"
            label="Date of birth"
            value={
              p.date_of_birth
                ? `${formatDate(p.date_of_birth)}${p.date_of_birth_is_estimate ? ' (estimated)' : ''}`
                : null
            }
          />
          <InfoRow
            icon="medical"
            tone="sage"
            label="Spayed / neutered"
            value={p.neutered === null ? null : p.neutered ? 'Yes' : 'No'}
          />
          <InfoRow icon="happy" tone="peach" label="Temperament" value={p.temperament} />
          {!p.date_of_birth && p.neutered === null && !p.temperament ? (
            <Text variant="body" color="textMuted">
              Add age, temperament and more so carers know {p.name} better.
            </Text>
          ) : null}
        </Card>

        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Text variant="heading">Health & care</Text>
            <StatusPill label="Only you" tone="neutral" />
          </View>
          <InfoRow icon="restaurant" tone="peach" label="Diet" value={p.dietary_notes} />
          <InfoRow icon="alert-circle" tone="coral" label="Allergies" value={p.allergies} />
          <InfoRow
            icon="fitness"
            tone="lavender"
            label="Known conditions"
            value={p.known_conditions}
          />
          <InfoRow icon="medkit" tone="sage" label="Medications" value={p.medications} />
          {!hasHealth ||
          (!p.dietary_notes && !p.allergies && !p.known_conditions && !p.medications) ? (
            <Text variant="body" color="textMuted">
              No care notes yet.
            </Text>
          ) : null}
        </Card>

        {p.emergency_contact_name || p.emergency_contact_phone ? (
          <Card style={styles.card}>
            <SectionHeader title="Emergency contact" />
            <InfoRow icon="person" tone="lavender" label="Name" value={p.emergency_contact_name} />
            <InfoRow icon="call" tone="sage" label="Phone" value={p.emergency_contact_phone} />
          </Card>
        ) : null}

        <Button
          testID="edit-pet"
          label="Edit profile"
          icon="create-outline"
          size="lg"
          fullWidth
          onPress={() => router.push(`/pets/${p.id}/edit`)}
        />
        <Button
          testID="delete-pet"
          label={`Remove ${p.name}`}
          variant="tertiary"
          fullWidth
          loading={remove.isPending}
          onPress={confirmDelete}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl + spacing.lg,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
    overflow: 'hidden',
  },
  avatarRing: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginBottom: spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: -spacing.xxxl,
    padding: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...elevation.raised,
  },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.lg },
  photoActions: { flexDirection: 'row', gap: spacing.md },
  flexButton: { flex: 1, alignSelf: 'stretch' },
  card: { gap: spacing.lg },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
