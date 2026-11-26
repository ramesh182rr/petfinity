import type { components } from '@/api/generated/schema';

type S = components['schemas'];
export type AreaKey = S['AreaKey'];
export type Area = S['AreaOut'];
export type AreasResponse = S['AreasResponse'];
export type Listing = S['Listing'];
export type SearchResponse = S['SearchResponse'];
export type ClinicDetail = S['ClinicDetail'];
export type VetDetail = S['VetDetail'];
export type PublicService = S['PublicService'];
export type PublicSlots = S['PublicSlots'];
export type KindFilter = S['KindFilter'];
export type SortOrder = S['SortOrder'];
export type ListingKind = S['ListingKind'];
export type DayHours = S['DayHours'];
export type Closure = S['Closure'];

/** Where the parent is searching from. Device coordinates are never sent anywhere else. */
export type SearchOrigin =
  | { type: 'area'; key: AreaKey; name: string }
  | { type: 'device'; latitude: number; longitude: number };

export type SearchFilters = {
  kind: KindFilter;
  category: S['ServiceCategory'] | null;
  openNow: boolean;
  emergency: boolean;
  sort: SortOrder;
  q: string;
  radiusKm: number;
};
