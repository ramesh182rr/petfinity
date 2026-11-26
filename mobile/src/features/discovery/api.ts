import { apiClient } from '@/api';

import type {
  AreasResponse,
  ClinicDetail,
  ListingKind,
  PublicSlots,
  SearchFilters,
  SearchOrigin,
  SearchResponse,
  VetDetail,
} from './types';

export const PAGE_SIZE = 20;

export function originParams(origin: SearchOrigin | null): Record<string, string> {
  if (!origin) return {};
  return origin.type === 'area'
    ? { area: origin.key }
    : { lat: origin.latitude.toFixed(4), lng: origin.longitude.toFixed(4) };
}

const query = (params: Record<string, string | undefined>) => {
  const parts = Object.entries(params)
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
};

export const getAreas = (): Promise<AreasResponse> => apiClient.request('/discover/areas');

export function search(
  origin: SearchOrigin,
  filters: SearchFilters,
  offset = 0,
): Promise<SearchResponse> {
  return apiClient.request(
    `/discover/search${query({
      ...originParams(origin),
      radius_km: String(filters.radiusKm),
      kind: filters.kind,
      category: filters.category ?? undefined,
      open_now: filters.openNow ? 'true' : undefined,
      emergency: filters.emergency ? 'true' : undefined,
      sort: filters.sort,
      q: filters.q.trim() || undefined,
      limit: String(PAGE_SIZE),
      offset: offset ? String(offset) : undefined,
    })}`,
  );
}

export const getClinic = (id: string, origin: SearchOrigin | null): Promise<ClinicDetail> =>
  apiClient.request(`/discover/clinics/${id}${query(originParams(origin))}`);

export const getVet = (id: string, origin: SearchOrigin | null): Promise<VetDetail> =>
  apiClient.request(`/discover/vets/${id}${query(originParams(origin))}`);

export const getSlots = (
  kind: ListingKind,
  id: string,
  serviceId: string,
  date: string,
): Promise<PublicSlots> =>
  apiClient.request(
    `/discover/${kind === 'clinic' ? 'clinics' : 'vets'}/${id}/slots${query({ service_id: serviceId, date })}`,
  );
