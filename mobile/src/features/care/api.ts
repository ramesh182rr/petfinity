import { apiClient } from '@/api';

import type { CareServiceIn, CareWorkspace } from './types';

const base = (id: string) => `/manage/provider_profile/${id}/care`;

export const getCare = (id: string): Promise<CareWorkspace> => apiClient.request(base(id));

export const putServices = (id: string, services: CareServiceIn[]): Promise<CareWorkspace> =>
  apiClient.request(`${base(id)}/services`, { method: 'PUT', body: { services } });
