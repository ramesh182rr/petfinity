import { router } from 'expo-router';

import { Screen } from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { ClinicForm } from '@/features/providers/ClinicForm';
import { useCreateClinic, useProviderProfiles } from '@/features/providers/hooks';

export default function NewClinicScreen() {
  const profiles = useProviderProfiles();
  const create = useCreateClinic();
  const isVet = !!profiles.data?.some((p) => p.provider_type === 'veterinarian');
  return (
    <Screen edges={[]} testID="new-clinic">
      <ClinicForm
        canPractise={isVet}
        submitLabel="Save and continue"
        submitting={create.isPending}
        serverError={create.isError ? errorMessage(create.error) : undefined}
        onSubmit={(payload) =>
          create.mutate(payload, {
            onSuccess: (c) => router.replace(`/provider/verify/clinic/${c.id}`),
          })
        }
      />
    </Screen>
  );
}
