import { router, useLocalSearchParams } from 'expo-router';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import { Screen } from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { usePet, useUpdatePet } from '@/features/pets/hooks';
import { PetForm } from '@/features/pets/PetForm';
import { toFormValues } from '@/features/pets/schema';

export default function EditPetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pet = usePet(id);
  const update = useUpdatePet(id);

  if (pet.isPending) return <LoadingState message="Loading pet…" />;
  if (pet.isError || !pet.data) {
    return (
      <ErrorState
        onRetry={() => void pet.refetch()}
        requestId={isApiError(pet.error) ? pet.error.requestId : null}
      />
    );
  }

  return (
    <Screen edges={[]} testID="edit-pet-screen">
      <PetForm
        initialValues={toFormValues(pet.data)}
        submitLabel="Save changes"
        submitting={update.isPending}
        serverError={update.isError ? errorMessage(update.error) : undefined}
        onSubmit={(payload) => update.mutate(payload, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
