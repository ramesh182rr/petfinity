import { apiClient } from '@/api';

import type {
  DayException,
  DayExceptionIn,
  OwnerType,
  Rule,
  Service,
  ServiceCreate,
  ServiceUpdate,
  SlotPreview,
  WeeklyHours,
} from './types';

const base = (type: OwnerType, id: string) => `/manage/${type}/${id}`;

export const listServices = (t: OwnerType, id: string): Promise<Service[]> =>
  apiClient.request(`${base(t, id)}/services`);
export const createService = (t: OwnerType, id: string, body: ServiceCreate): Promise<Service> =>
  apiClient.request(`${base(t, id)}/services`, { method: 'POST', body });
export const updateService = (
  t: OwnerType,
  id: string,
  serviceId: string,
  body: ServiceUpdate,
): Promise<Service> =>
  apiClient.request(`${base(t, id)}/services/${serviceId}`, { method: 'PATCH', body });
export const archiveService = (t: OwnerType, id: string, serviceId: string): Promise<void> =>
  apiClient.request(`${base(t, id)}/services/${serviceId}`, { method: 'DELETE' });

export const getHours = (t: OwnerType, id: string): Promise<WeeklyHours> =>
  apiClient.request(`${base(t, id)}/availability`);
export const putHours = (t: OwnerType, id: string, rules: Rule[]): Promise<WeeklyHours> =>
  apiClient.request(`${base(t, id)}/availability`, { method: 'PUT', body: { rules } });

export const listExceptions = (t: OwnerType, id: string): Promise<DayException[]> =>
  apiClient.request(`${base(t, id)}/exceptions`);
export const addException = (
  t: OwnerType,
  id: string,
  body: DayExceptionIn,
): Promise<DayException> =>
  apiClient.request(`${base(t, id)}/exceptions`, { method: 'POST', body });
export const deleteException = (t: OwnerType, id: string, exceptionId: string): Promise<void> =>
  apiClient.request(`${base(t, id)}/exceptions/${exceptionId}`, { method: 'DELETE' });

export const previewSlots = (
  t: OwnerType,
  id: string,
  serviceId: string,
  date: string,
): Promise<SlotPreview> =>
  apiClient.request(
    `${base(t, id)}/slots?service_id=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`,
  );
