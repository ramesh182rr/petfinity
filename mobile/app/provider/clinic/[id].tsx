import { router, useLocalSearchParams } from 'expo-router';

import { isApiError } from '@/api';
import { ErrorState, LoadingState } from '@/components/states/StateViews';
import { Screen } from '@/components/ui';
import { errorMessage } from '@/features/auth/errorMessage';
import { ClinicForm } from '@/features/providers/ClinicForm';
import { useClinic, useUpdateClinic } from '@/features/providers/hooks';

export default function EditClinicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const clinic = useClinic(id);
  const update = useUpdateClinic(id);
  if (clinic.isPending) return <LoadingState message="Loading clinic…" />;
  if (clinic.isError) {
    return (
      <ErrorState
        onRetry={() => void clinic.refetch()}
        requestId={isApiError(clinic.error) ? clinic.error.requestId : null}
      />
    );
  }
  return (
    <Screen edges={[]} testID="edit-clinic">
      <ClinicForm
        initial={clinic.data}
        canPractise={false}
        submitLabel="Save changes"
        submitting={update.isPending}
        serverError={update.isError ? errorMessage(update.error) : undefined}
        onSubmit={({ practises_here: _ignored, ...payload }) =>
          update.mutate(payload, { onSuccess: () => router.back() })
        }
      />
    </Screen>
  );
}
