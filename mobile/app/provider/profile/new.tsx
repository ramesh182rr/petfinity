import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { useCreateProfile } from '@/features/providers/hooks';
import { ProviderProfileForm } from '@/features/providers/ProviderProfileForm';
import type { ProviderType } from '@/features/providers/types';

export default function NewProviderProfileScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const type: ProviderType = params.type === 'caretaker' ? 'caretaker' : 'veterinarian';
  const create = useCreateProfile();
  return (
    <Screen edges={[]} testID="new-provider-profile">
      <ProviderProfileForm
        type={type}
        submitLabel="Save and continue"
        submitting={create.isPending}
        serverError={create.isError ? errorMessage(create.error) : undefined}
        onSubmit={(payload) =>
          create.mutate(
            { ...payload, provider_type: type, display_name: payload.display_name ?? '' },
            { onSuccess: (p) => router.replace(`/provider/verify/provider_profile/${p.id}`) },
          )
        }
      />
    </Screen>
  );
}
