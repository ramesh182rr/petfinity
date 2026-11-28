import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as api from './api';
import type { CareServiceIn } from './types';

export const careKeys = { workspace: (id: string) => ['care', id] as const };

export const useCare = (id: string) =>
  useQuery({ queryKey: careKeys.workspace(id), queryFn: () => api.getCare(id) });

export function useSaveCareServices(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (services: CareServiceIn[]) => api.putServices(id, services),
    onSuccess: (data) => qc.setQueryData(careKeys.workspace(id), data),
  });
}
