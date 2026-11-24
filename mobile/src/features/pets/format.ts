import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { IconBadgeTone } from '@/components/ui';

import type { Pet, Species } from './types';

export const SPECIES_OPTIONS: { value: Species; label: string }[] = [
  { value: 'dog', label: 'Dog' },
  { value: 'cat', label: 'Cat' },
  { value: 'bird', label: 'Bird' },
  { value: 'rabbit', label: 'Rabbit' },
  { value: 'guinea_pig', label: 'Guinea pig' },
  { value: 'hamster', label: 'Hamster' },
  { value: 'fish', label: 'Fish' },
  { value: 'turtle', label: 'Turtle' },
  { value: 'reptile', label: 'Reptile' },
  { value: 'horse', label: 'Horse' },
  { value: 'cow', label: 'Cow' },
  { value: 'goat', label: 'Goat' },
  { value: 'other', label: 'Other' },
];

const LABELS = Object.fromEntries(SPECIES_OPTIONS.map((o) => [o.value, o.label])) as Record<
  Species,
  string
>;

export function speciesLabel(pet: Pick<Pet, 'species' | 'species_other'>): string {
  return pet.species === 'other' && pet.species_other ? pet.species_other : LABELS[pet.species];
}

type IconName = ComponentProps<typeof Ionicons>['name'];

export function speciesIcon(species: Species): { name: IconName; tone: IconBadgeTone } {
  switch (species) {
    case 'dog':
      return { name: 'paw', tone: 'peach' };
    case 'cat':
      return { name: 'paw', tone: 'lavender' };
    case 'bird':
      return { name: 'leaf', tone: 'sage' };
    case 'fish':
      return { name: 'water', tone: 'lavender' };
    default:
      return { name: 'heart', tone: 'coral' };
  }
}

/** "3 yrs", "7 mos", "2 wks"; prefixed with "~" when the birth date is estimated. */
export function ageLabel(
  pet: Pick<Pet, 'date_of_birth' | 'date_of_birth_is_estimate'>,
  today: Date = new Date(),
): string | null {
  if (!pet.date_of_birth) return null;
  const dob = new Date(`${pet.date_of_birth}T00:00:00`);
  let months = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth());
  if (today.getDate() < dob.getDate()) months -= 1;
  const prefix = pet.date_of_birth_is_estimate ? '~' : '';
  if (months >= 12) {
    const years = Math.floor(months / 12);
    return `${prefix}${years} ${years === 1 ? 'yr' : 'yrs'}`;
  }
  if (months >= 1) return `${prefix}${months} ${months === 1 ? 'mo' : 'mos'}`;
  const weeks = Math.max(0, Math.floor((today.getTime() - dob.getTime()) / (7 * 86_400_000)));
  return `${prefix}${weeks} ${weeks === 1 ? 'wk' : 'wks'}`;
}

export function petSubtitle(pet: Pet): string {
  return [speciesLabel(pet), pet.breed, ageLabel(pet)].filter(Boolean).join(' · ');
}

/** YYYY-MM-DD in local time (what the API expects for dates). */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
