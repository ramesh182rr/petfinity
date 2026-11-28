import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

import type { IconBadgeTone } from '@/components/ui';

import type { CareType, ReadinessItem } from './types';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const CARE_TYPES: {
  value: CareType;
  label: string;
  where: string;
  unit: 'visit' | 'day' | 'night';
  icon: IconName;
  tone: IconBadgeTone;
}[] = [
  {
    value: 'home_visit',
    label: 'Home visits',
    where: 'Drop-ins at the pet parent’s home: feeding, walks, medicines',
    unit: 'visit',
    icon: 'walk',
    tone: 'sage',
  },
  {
    value: 'day_care',
    label: 'Day care',
    where: 'Pets spend the day at your home',
    unit: 'day',
    icon: 'sunny',
    tone: 'peach',
  },
  {
    value: 'boarding',
    label: 'Boarding',
    where: 'Overnight stays at your home',
    unit: 'night',
    icon: 'moon',
    tone: 'lavender',
  },
  {
    value: 'house_sitting',
    label: 'House sitting',
    where: 'You stay at the pet parent’s home',
    unit: 'night',
    icon: 'home',
    tone: 'coral',
  },
];

export const CARE_LABEL = Object.fromEntries(CARE_TYPES.map((t) => [t.value, t])) as Record<
  CareType,
  (typeof CARE_TYPES)[number]
>;

/** How each type reads to a pet parent. */
export const PARENT_WHERE: Record<CareType, string> = {
  home_visit: 'Drop-ins at your home: feeding, walks, medicines',
  day_care: 'Your pet spends the day at the caretaker’s home',
  boarding: 'Overnight stays at the caretaker’s home',
  house_sitting: 'The caretaker stays at your home',
};

export const AT_CARETAKER_HOME: CareType[] = ['day_care', 'boarding'];

export const READINESS: Record<ReadinessItem, { title: string; hint: string; icon: IconName }> = {
  services: {
    title: 'Choose your services',
    hint: 'Pick the care you offer and set a starting rate.',
    icon: 'pricetags',
  },
  service_area: {
    title: 'Set where you work',
    hint: 'Your area and how far you travel. Your pin stays private.',
    icon: 'location',
  },
  home_details: {
    title: 'Describe your home',
    hint: 'Needed for day care and boarding.',
    icon: 'home',
  },
  capacity: {
    title: 'Set how many bookings at once',
    hint: 'So you’re never booked beyond what you can handle.',
    icon: 'people',
  },
  verification: {
    title: 'Get verified',
    hint: 'Identity and address proof, checked by Petfinity.',
    icon: 'shield-checkmark',
  },
};

export const SPECIES_LABEL: Record<string, string> = {
  dog: 'Dogs',
  cat: 'Cats',
  other: 'Other pets',
};

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const clock = (iso: string) => {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

/** "Fri 4 Dec, 6:00 pm → Mon 7 Dec, 10:00 am" (or a single day for visits/day care). */
export function careWhen(startIso: string, endIso: string): string {
  const sameDay = new Date(startIso).toDateString() === new Date(endIso).toDateString();
  return sameDay
    ? `${day(startIso)}, ${clock(startIso)} – ${clock(endIso)}`
    : `${day(startIso)}, ${clock(startIso)} → ${day(endIso)}, ${clock(endIso)}`;
}

export function unitsLabel(units: number, unit: string): string {
  return `${units} ${unit}${units === 1 ? '' : 's'}`;
}

export function petsLabel(pets: { name: string }[]): string {
  return pets.map((p) => p.name).join(', ');
}

/** "Offers close in 5 h" / "Offers closed". */
export function closesLabel(iso: string, accepting: boolean, now: Date = new Date()): string {
  if (!accepting) return 'No longer taking new offers';
  const mins = Math.max(0, Math.round((new Date(iso).getTime() - now.getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  const rest = mins % 60;
  return `Offers close in ${h ? `${h} h${rest ? ` ${rest} min` : ''}` : `${mins} min`}`;
}

export const REQUEST_STATUS: Record<
  string,
  { label: string; tone: 'primary' | 'success' | 'neutral' | 'warning' }
> = {
  open: { label: 'Open', tone: 'primary' },
  booked: { label: 'Booked', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
};

/** Compact dates for cards: "Mon 30 Nov → Wed 2 Dec", or one day with its hours. */
export function careDates(startIso: string, endIso: string): string {
  const short = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return new Date(startIso).toDateString() === new Date(endIso).toDateString()
    ? careWhen(startIso, endIso)
    : `${short(startIso)} → ${short(endIso)}`;
}
