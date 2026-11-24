import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import { Button, Card, Screen, Text } from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { ageLabel, formatDate, speciesLabel } from '@/features/pets/format';
import { useDeletePet, usePet, useRemovePetPhoto, useUploadPetPhoto } from '@/features/pets/hooks';
import { pickPetPhoto } from '@/features/pets/imagePicking';
import { PetAvatar } from '@/features/pets/PetAvatar';
import { spacing } from '@/theme';

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </View>
  );
}

export default function PetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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

  const neutered = p.neutered === null ? null : p.neutered ? 'Yes' : 'No';
  const sex = p.sex === 'unknown' ? null : p.sex === 'male' ? 'Male' : 'Female';
  const dob = p.date_of_birth
    ? `${formatDate(p.date_of_birth)}${p.date_of_birth_is_estimate ? ' (estimated)' : ''}`
    : null;
  const health = [p.temperament, p.dietary_notes, p.allergies, p.known_conditions, p.medications];

  return (
    <Screen edges={[]} testID="pet-detail-screen">
      <Stack.Screen options={{ title: p.name }} />
      <View style={styles.hero}>
        <PetAvatar pet={p} size={112} />
        <Text variant="title" align="center">
          {p.name}
        </Text>
        <Text variant="body" color="textMuted" align="center">
          {[speciesLabel(p), p.breed, ageLabel(p)].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.photoActions}>
          <Button
            testID="change-photo"
            variant="secondary"
            icon="camera-outline"
            label={p.photo_url ? 'Change photo' : 'Add photo'}
            loading={upload.isPending}
            onPress={() => void changePhoto()}
          />
          {p.photo_url ? (
            <Button
              variant="tertiary"
              label="Remove photo"
              loading={removePhoto.isPending}
              onPress={() => removePhoto.mutate()}
            />
          ) : null}
        </View>
        {upload.isError ? (
          <Text variant="caption" color="error" accessibilityRole="alert">
            {upload.error instanceof Error && !isApiError(upload.error)
              ? "The photo didn't upload. Check your connection and try again."
              : errorMessage(upload.error)}
          </Text>
        ) : null}
      </View>

      <Card style={styles.card}>
        <Text variant="subheading">About</Text>
        <Row label="Sex" value={sex} />
        <Row label="Date of birth" value={dob} />
        <Row label="Weight" value={p.weight_kg ? `${Number(p.weight_kg)} kg` : null} />
        <Row label="Spayed / neutered" value={neutered} />
        {!sex && !dob && !p.weight_kg && !neutered ? (
          <Text variant="body" color="textMuted">
            Add age, weight and more so carers know {p.name} better.
          </Text>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Text variant="subheading">Health & care</Text>
        <Text variant="caption" color="textMuted">
          Only visible to you.
        </Text>
        <Row label="Temperament" value={p.temperament} />
        <Row label="Diet" value={p.dietary_notes} />
        <Row label="Allergies" value={p.allergies} />
        <Row label="Known conditions" value={p.known_conditions} />
        <Row label="Medications" value={p.medications} />
        {health.every((v) => !v) ? (
          <Text variant="body" color="textMuted">
            No care notes yet.
          </Text>
        ) : null}
      </Card>

      {p.emergency_contact_name || p.emergency_contact_phone ? (
        <Card style={styles.card}>
          <Text variant="subheading">Emergency contact</Text>
          <Row label="Name" value={p.emergency_contact_name} />
          <Row label="Phone" value={p.emergency_contact_phone} />
        </Card>
      ) : null}

      <Button
        testID="edit-pet"
        label="Edit profile"
        icon="create-outline"
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm },
  photoActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  card: { gap: spacing.md },
  row: { gap: spacing.xxs },
});
