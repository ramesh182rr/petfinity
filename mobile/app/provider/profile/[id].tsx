import { router, useLocalSearchParams } from 'expo-router';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import { Screen } from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { useProviderProfile, useUpdateProfile } from '@/features/providers/hooks';
import { ProviderProfileForm } from '@/features/providers/ProviderProfileForm';

export default function EditProviderProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useProviderProfile(id);
  const update = useUpdateProfile(id);
  if (profile.isPending) return <LoadingState message="Loading profile…" />;
  if (profile.isError) {
    return (
      <ErrorState
        onRetry={() => void profile.refetch()}
        requestId={isApiError(profile.error) ? profile.error.requestId : null}
      />
    );
  }
  return (
    <Screen edges={[]} testID="edit-provider-profile">
      <ProviderProfileForm
        type={profile.data.provider_type}
        initial={profile.data}
        submitLabel="Save changes"
        submitting={update.isPending}
        serverError={update.isError ? errorMessage(update.error) : undefined}
        onSubmit={(payload) => update.mutate(payload, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
