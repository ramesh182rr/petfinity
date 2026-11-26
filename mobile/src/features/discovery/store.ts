import { create } from 'zustand';

import type { SearchFilters, SearchOrigin } from './types';

export const DEFAULT_FILTERS: SearchFilters = {
  kind: 'all',
  category: null,
  openNow: false,
  emergency: false,
  sort: 'distance',
  q: '',
  radiusKm: 10,
};

/** Discover's location and filters. In memory only: device coordinates are not persisted. */
type DiscoveryState = {
  origin: SearchOrigin | null;
  filters: SearchFilters;
  setOrigin: (origin: SearchOrigin) => void;
  setFilters: (patch: Partial<SearchFilters>) => void;
  resetFilters: () => void;
};

export const useDiscoveryStore = create<DiscoveryState>()((set) => ({
  origin: null,
  filters: DEFAULT_FILTERS,
  setOrigin: (origin) => set({ origin }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  resetFilters: () => set((s) => ({ filters: { ...DEFAULT_FILTERS, q: s.filters.q } })),
}));

export function resetDiscoveryForTests() {
  useDiscoveryStore.setState({ origin: null, filters: DEFAULT_FILTERS });
}
