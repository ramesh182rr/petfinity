import type { IconBadgeTone } from '@/components/ui';

import type { ServiceCategory } from './types';

export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
export const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const CATEGORIES: { value: ServiceCategory; label: string }[] = [
  { value: 'general_consultation', label: 'Consultation' },
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'deworming', label: 'Deworming' },
  { value: 'preventive_check', label: 'Preventive check' },
  { value: 'skin_ear', label: 'Skin & ear' },
  { value: 'dental', label: 'Dental' },
  { value: 'diagnostics', label: 'Diagnostics' },
  { value: 'blood_test', label: 'Blood test' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'sterilisation', label: 'Sterilisation' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'emergency', label: 'Emergency' },
];

export const CATEGORY_LABEL = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, c.label]),
) as Record<ServiceCategory, string>;

export function categoryTone(category: ServiceCategory): IconBadgeTone {
  if (category === 'emergency' || category === 'surgery') return 'coral';
  if (category === 'vaccination' || category === 'deworming' || category === 'preventive_check')
    return 'sage';
  if (category === 'dental' || category === 'skin_ear') return 'peach';
  return 'lavender';
}

/** ₹ formatting from paise, Indian digit grouping, no decimals when whole. */
export function formatRupees(minor: number): string {
  const rupees = minor / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: rupees % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/** "450" or "450.50" → 45050 paise; null if invalid. */
export function parseRupees(input: string): number | null {
  const value = input.replace(/[₹,\s]/g, '');
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(value)) return null;
  return Math.round(Number(value) * 100);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "09:00:00" → "9:00 am" */
export function formatTime(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function toHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function fromHHMM(hhmm: string): Date {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/** Round to the 5-minute grid the API requires. */
export function snapToFive(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(Math.round(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

/** Next `count` dates (local) as YYYY-MM-DD with labels. */
export function upcomingDays(
  count: number,
  from: Date = new Date(),
): { iso: string; label: string; weekday: string }[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      iso,
      label:
        i === 0
          ? 'Today'
          : i === 1
            ? 'Tomorrow'
            : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      weekday: WEEKDAYS_SHORT[(d.getDay() + 6) % 7] ?? '',
    };
  });
}
