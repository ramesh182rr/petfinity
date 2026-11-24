import { useQuery } from '@tanstack/react-query';

import { apiClient, type ApiClient } from '@/api';
import type { components } from '@/api/generated/schema';

export type HealthResponse = components['schemas']['HealthResponse'];

export function getHealth(client: ApiClient = apiClient): Promise<HealthResponse> {
  return client.request<HealthResponse>('/health');
}

export const healthQueryKey = ['system', 'health'] as const;

export function useApiHealth() {
  return useQuery({ queryKey: healthQueryKey, queryFn: () => getHealth(), retry: false });
}
