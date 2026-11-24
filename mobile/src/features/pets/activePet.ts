import { create } from 'zustand';

import type { Pet } from './types';

/** The pet the user is currently acting for (booking, reminders). In-memory for now. */
type ActivePetState = { activePetId: string | null; setActivePet: (id: string | null) => void };

export const useActivePetStore = create<ActivePetState>()((set) => ({
  activePetId: null,
  setActivePet: (id) => set({ activePetId: id }),
}));

/** Falls back to the first pet when nothing (or a deleted pet) is selected. */
export function resolveActivePet(pets: Pet[] | undefined, activePetId: string | null): Pet | null {
  if (!pets?.length) return null;
  return pets.find((p) => p.id === activePetId) ?? pets[0] ?? null;
}
