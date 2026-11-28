import { fromHHMM, parseRupees } from '@/features/catalog/format';
import type { AreaKey } from '@/features/discovery/types';

import { unitsLabel } from './format';
import type { CareRequestIn, CareType } from './types';

export type CareForm = {
  careType: CareType;
  petIds: string[];
  startDate: Date;
  startTime: string;
  endDate: Date;
  endTime: string;
  visitsPerDay: number;
  areaKey: string | null;
  latitude: string | null;
  longitude: string | null;
  locality: string;
  address: string;
  notes: string;
  budget: string;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
};

/** Sensible starting dates and times for each care type. */
export function defaultsFor(
  careType: CareType,
  today: Date = new Date(),
): Pick<CareForm, 'careType' | 'startDate' | 'startTime' | 'endDate' | 'endTime' | 'visitsPerDay'> {
  switch (careType) {
    case 'home_visit':
      return {
        careType,
        startDate: addDays(today, 1),
        startTime: '08:00',
        endDate: addDays(today, 3),
        endTime: '20:00',
        visitsPerDay: 2,
      };
    case 'day_care':
      return {
        careType,
        startDate: addDays(today, 1),
        startTime: '09:00',
        endDate: addDays(today, 1),
        endTime: '18:00',
        visitsPerDay: 1,
      };
    default:
      return {
        careType,
        startDate: addDays(today, 3),
        startTime: '18:00',
        endDate: addDays(today, 6),
        endTime: '10:00',
        visitsPerDay: 1,
      };
  }
}

export function combine(date: Date, hhmm: string): Date {
  const t = fromHHMM(hhmm);
  const d = new Date(date);
  d.setHours(t.getHours(), t.getMinutes(), 0, 0);
  return d;
}

const dayDiff = (a: Date, b: Date) =>
  Math.round((addDays(b, 0).getTime() - addDays(a, 0).getTime()) / 86_400_000);

/** Mirrors the API: visits = days × visits a day; day care = days; overnight = nights. */
export function estimateUnits(form: CareForm): string | null {
  const diff = dayDiff(form.startDate, form.endDate);
  if (diff < 0) return null;
  if (form.careType === 'home_visit') return unitsLabel((diff + 1) * form.visitsPerDay, 'visit');
  if (form.careType === 'day_care') return unitsLabel(diff + 1, 'day');
  return diff >= 1 ? unitsLabel(diff, 'night') : null;
}

export function buildRequest(
  form: CareForm,
): { ok: true; body: CareRequestIn } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const start = combine(form.startDate, form.startTime);
  const end = combine(form.endDate, form.endTime);
  const overnight = form.careType === 'boarding' || form.careType === 'house_sitting';
  if (!form.petIds.length) errors.pets = 'Choose at least one pet.';
  if (form.petIds.length > 5) errors.pets = 'Up to 5 pets per request.';
  if (end <= start) errors.dates = 'The end must be after the start.';
  else if (overnight && dayDiff(form.startDate, form.endDate) < 1)
    errors.dates = 'Overnight care needs at least one night.';
  if (!form.areaKey) errors.area = 'Choose your area.';
  if (form.locality.trim().length < 2) errors.locality = 'Add your locality, e.g. Adyar.';
  const needsAddress = form.careType === 'home_visit' || form.careType === 'house_sitting';
  if (needsAddress && form.address.trim().length < 5) errors.address = 'Add the full address.';
  const budget = form.budget.trim() ? parseRupees(form.budget) : null;
  if (form.budget.trim() && budget === null) errors.budget = 'Enter an amount in rupees.';
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    body: {
      care_type: form.careType,
      pet_ids: form.petIds,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      visits_per_day: form.careType === 'home_visit' ? form.visitsPerDay : null,
      area_key: form.areaKey as AreaKey,
      locality: form.locality.trim(),
      latitude: form.latitude,
      longitude: form.longitude,
      address: needsAddress ? form.address.trim() : null,
      notes: form.notes.trim() || null,
      budget_minor: budget,
    },
  };
}
