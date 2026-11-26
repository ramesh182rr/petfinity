import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import * as api from './api';
import type { ListingKind, SearchFilters, SearchOrigin } from './types';

export const discoveryKeys = {
  areas: ['discover', 'areas'] as const,
  search: (origin: SearchOrigin | null, filters: SearchFilters) =>
    ['discover', 'search', origin, filters] as const,
  detail: (kind: ListingKind, id: string, origin: SearchOrigin | null) =>
    ['discover', kind, id, origin] as const,
  slots: (kind: ListingKind, id: string, serviceId: string, date: string) =>
    ['discover', kind, id, 'slots', serviceId, date] as const,
};

/** The launch areas rarely change: fetch once per app session. */
export const useAreas = () =>
  useQuery({ queryKey: discoveryKeys.areas, queryFn: api.getAreas, staleTime: Infinity });

export function useSearch(origin: SearchOrigin | null, filters: SearchFilters) {
  return useInfiniteQuery({
    queryKey: discoveryKeys.search(origin, filters),
    queryFn: ({ pageParam }) => {
      if (!origin) throw new Error('No search origin');
      return api.search(origin, filters, pageParam);
    },
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    enabled: !!origin,
  });
}

export const useClinicListing = (id: string, origin: SearchOrigin | null) =>
  useQuery({
    queryKey: discoveryKeys.detail('clinic', id, origin),
    queryFn: () => api.getClinic(id, origin),
    enabled: !!id,
  });

export const useVetListing = (id: string, origin: SearchOrigin | null) =>
  useQuery({
    queryKey: discoveryKeys.detail('vet', id, origin),
    queryFn: () => api.getVet(id, origin),
    enabled: !!id,
  });

export const usePublicSlots = (
  kind: ListingKind,
  id: string,
  serviceId: string | null,
  date: string,
) =>
  useQuery({
    queryKey: discoveryKeys.slots(kind, id, serviceId ?? '', date),
    queryFn: () => api.getSlots(kind, id, serviceId ?? '', date),
    enabled: !!serviceId,
  });
