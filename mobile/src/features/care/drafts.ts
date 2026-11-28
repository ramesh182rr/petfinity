import { parseRupees } from '@/features/catalog/format';

import { CARE_TYPES } from './format';
import type { CareService, CareServiceIn, CareType } from './types';

export type Draft = {
  on: boolean;
  rate: string;
  species: string[];
  maxPets: number;
};

export const SPECIES = ['dog', 'cat', 'other'] as const;

export function initialDrafts(services: CareService[]): Record<CareType, Draft> {
  const byType = Object.fromEntries(services.map((s) => [s.care_type, s]));
  return Object.fromEntries(
    CARE_TYPES.map((t) => {
      const s = byType[t.value] as CareService | undefined;
      return [
        t.value,
        {
          on: !!s?.active,
          rate: s ? String(s.rate_minor / 100) : '',
          species: s?.species ?? ['dog', 'cat'],
          maxPets: s?.max_pets ?? 2,
        },
      ];
    }),
  ) as Record<CareType, Draft>;
}

/** Validates drafts; returns the payload or a per-type error message. */
export function toCareServices(
  drafts: Record<CareType, Draft>,
):
  | { ok: true; services: CareServiceIn[] }
  | { ok: false; errors: Partial<Record<CareType, string>> } {
  const errors: Partial<Record<CareType, string>> = {};
  const services: CareServiceIn[] = [];
  for (const t of CARE_TYPES) {
    const d = drafts[t.value];
    if (!d.on) continue;
    const rate = parseRupees(d.rate);
    if (rate === null) errors[t.value] = 'Enter a starting rate in rupees.';
    else if (!d.species.length) errors[t.value] = 'Choose at least one kind of pet.';
    else
      services.push({
        care_type: t.value,
        rate_minor: rate,
        species: d.species as CareServiceIn['species'],
        max_pets: d.maxPets,
        active: true,
      });
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, services };
}
