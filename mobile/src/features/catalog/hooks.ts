import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as api from './api';
import type { DayExceptionIn, OwnerType, Rule, ServiceCreate, ServiceUpdate } from './types';

export const catalogKeys = {
  all: (t: OwnerType, id: string) => ['catalog', t, id] as const,
  services: (t: OwnerType, id: string) => ['catalog', t, id, 'services'] as const,
  hours: (t: OwnerType, id: string) => ['catalog', t, id, 'hours'] as const,
  exceptions: (t: OwnerType, id: string) => ['catalog', t, id, 'exceptions'] as const,
  slots: (t: OwnerType, id: string, serviceId: string, date: string) =>
    ['catalog', t, id, 'slots', serviceId, date] as const,
};

export const useServices = (t: OwnerType, id: string) =>
  useQuery({ queryKey: catalogKeys.services(t, id), queryFn: () => api.listServices(t, id) });
export const useHours = (t: OwnerType, id: string) =>
  useQuery({ queryKey: catalogKeys.hours(t, id), queryFn: () => api.getHours(t, id) });
export const useExceptions = (t: OwnerType, id: string) =>
  useQuery({ queryKey: catalogKeys.exceptions(t, id), queryFn: () => api.listExceptions(t, id) });
export const useSlotPreview = (t: OwnerType, id: string, serviceId: string | null, date: string) =>
  useQuery({
    queryKey: catalogKeys.slots(t, id, serviceId ?? '', date),
    queryFn: () => api.previewSlots(t, id, serviceId ?? '', date),
    enabled: !!serviceId,
  });

function useInvalidate(t: OwnerType, id: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: catalogKeys.all(t, id) });
}

export function useSaveService(t: OwnerType, id: string, serviceId?: string) {
  const invalidate = useInvalidate(t, id);
  return useMutation({
    mutationFn: (body: ServiceCreate) =>
      serviceId
        ? api.updateService(t, id, serviceId, body as ServiceUpdate)
        : api.createService(t, id, body),
    onSuccess: invalidate,
  });
}

export function useArchiveService(t: OwnerType, id: string) {
  const invalidate = useInvalidate(t, id);
  return useMutation({
    mutationFn: (serviceId: string) => api.archiveService(t, id, serviceId),
    onSuccess: invalidate,
  });
}

export function useToggleService(t: OwnerType, id: string) {
  const invalidate = useInvalidate(t, id);
  return useMutation({
    mutationFn: ({ serviceId, active }: { serviceId: string; active: boolean }) =>
      api.updateService(t, id, serviceId, { active }),
    onSuccess: invalidate,
  });
}

export function useSaveHours(t: OwnerType, id: string) {
  const invalidate = useInvalidate(t, id);
  return useMutation({
    mutationFn: (rules: Rule[]) => api.putHours(t, id, rules),
    onSuccess: invalidate,
  });
}

export function useAddException(t: OwnerType, id: string) {
  const invalidate = useInvalidate(t, id);
  return useMutation({
    mutationFn: (body: DayExceptionIn) => api.addException(t, id, body),
    onSuccess: invalidate,
  });
}

export function useDeleteException(t: OwnerType, id: string) {
  const invalidate = useInvalidate(t, id);
  return useMutation({
    mutationFn: (exceptionId: string) => api.deleteException(t, id, exceptionId),
    onSuccess: invalidate,
  });
}
