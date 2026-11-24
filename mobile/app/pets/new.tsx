import { router } from 'expo-router';

import { Screen } from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { useCreatePet } from '@/features/pets/hooks';
import { PetForm } from '@/features/pets/PetForm';
import { emptyPetForm } from '@/features/pets/schema';

export default function NewPetScreen() {
  const create = useCreatePet();
  return (
    <Screen edges={[]} testID="new-pet-screen">
      <PetForm
        initialValues={emptyPetForm}
        submitLabel="Save pet"
        submitting={create.isPending}
        serverError={create.isError ? errorMessage(create.error) : undefined}
        onSubmit={(payload) =>
          create.mutate(payload, { onSuccess: (pet) => router.replace(`/pets/${pet.id}`) })
        }
      />
    </Screen>
  );
}
