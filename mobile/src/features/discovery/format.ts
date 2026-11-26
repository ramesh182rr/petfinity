import { formatTime } from '@/features/catalog/format';

import type { Listing, SearchOrigin } from './types';

export function originLabel(origin: SearchOrigin | null): string {
  if (!origin) return 'Choose area';
  return origin.type === 'area' ? origin.name : 'Near you';
}

export function distanceLabel(km: number | null | undefined, approximate = false): string | null {
  if (km == null) return null;
  if (approximate) return `~${Math.max(1, Math.round(km))} km`;
  return km < 1 ? '<1 km' : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** "Today 4:30 pm" / "Tomorrow 9:00 am" / "Fri 9:00 am", in the device's timezone (IST). */
export function slotLabel(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(at) - day(now)) / 86_400_000);
  const hhmm = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
  const prefix =
    diff === 0
      ? 'Today'
      : diff === 1
        ? 'Tomorrow'
        : at.toLocaleDateString('en-IN', { weekday: 'short' });
  return `${prefix} ${formatTime(hhmm)}`;
}

/** The second line of a listing card: where it is and how far. */
export function whereLabel(listing: Listing): string {
  if (listing.kind === 'vet') {
    return [listing.area_name, `Home visits within ${listing.service_radius_km} km`]
      .filter(Boolean)
      .join(' · ');
  }
  return [listing.subtitle, distanceLabel(listing.distance_km, listing.distance_is_approximate)]
    .filter(Boolean)
    .join(' · ');
}

/** Name for initials: "Dr. Priya Nair" → "Priya Nair" (so the avatar reads "PN"). */
export const avatarName = (name: string) => name.replace(/^dr\.?\s+/i, '');
