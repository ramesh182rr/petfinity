import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

import type { IconBadgeTone, PillTone } from '@/components/ui';
import { formatTime } from '@/features/catalog/format';

import type { Booking, BookingStatus, PaymentStatus } from './types';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const STATUS_INFO: Record<
  BookingStatus,
  { label: string; tone: PillTone; icon: IconName; badge: IconBadgeTone }
> = {
  pending_provider: {
    label: 'Awaiting confirmation',
    tone: 'warning',
    icon: 'hourglass',
    badge: 'peach',
  },
  confirmed: { label: 'Confirmed', tone: 'success', icon: 'checkmark-circle', badge: 'sage' },
  in_progress: { label: 'Checked in', tone: 'primary', icon: 'medkit', badge: 'lavender' },
  completed: { label: 'Completed', tone: 'success', icon: 'ribbon', badge: 'sage' },
  declined: { label: 'Declined', tone: 'error', icon: 'close-circle', badge: 'coral' },
  expired: { label: 'Not confirmed', tone: 'error', icon: 'time', badge: 'coral' },
  cancelled_by_owner: { label: 'Cancelled', tone: 'neutral', icon: 'close-circle', badge: 'peach' },
  cancelled_by_provider: {
    label: 'Cancelled by provider',
    tone: 'error',
    icon: 'close-circle',
    badge: 'coral',
  },
  cancelled_by_admin: {
    label: 'Cancelled by Petfinity',
    tone: 'neutral',
    icon: 'close-circle',
    badge: 'peach',
  },
  no_show: { label: 'Missed', tone: 'error', icon: 'alert-circle', badge: 'coral' },
  disputed: { label: 'Under review', tone: 'warning', icon: 'help-circle', badge: 'peach' },
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  not_due: 'Pay after confirmation',
  unpaid: 'Not paid yet',
  pay_at_visit: 'Paying at the visit',
  paid: 'Paid (mock)',
  refunded: 'Refunded (mock)',
  not_refunded: 'Not refunded (late cancellation)',
};

const pad = (n: number) => String(n).padStart(2, '0');

/** "Fri, 27 Nov" in the device's timezone (India for the launch markets). */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** "9:30 am". */
export function formatClock(iso: string): string {
  const d = new Date(iso);
  return formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
}

/** "Monday" for compact tiles. */
export function formatWeekday(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { weekday: 'long' });
}

/** "30 Nov" for compact tiles. */
export function formatShortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatWhen(iso: string): string {
  return `${formatDay(iso)} · ${formatClock(iso)}`;
}

export function dateTile(iso: string): { weekday: string; day: string; month: string } {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    day: String(d.getDate()),
    month: d.toLocaleDateString('en-IN', { month: 'short' }),
  };
}

/** What cancelling now means, shown before the parent confirms (decision 0012). */
export function cancelPreview(booking: Booking, now: Date = new Date()): string {
  if (booking.status === 'pending_provider') {
    return 'Your request is withdrawn. Nothing is charged.';
  }
  const paid = booking.payment_status === 'paid';
  if (now.getTime() <= new Date(booking.policy.free_cancellation_until).getTime()) {
    return paid
      ? 'Free cancellation. Your mock payment is refunded in full.'
      : 'Free cancellation. Nothing is charged.';
  }
  return paid
    ? `It's less than ${booking.policy.free_cancellation_hours_before} hours to go, so this is a late cancellation and the payment isn't refunded.`
    : `It's less than ${booking.policy.free_cancellation_hours_before} hours to go, so this counts as a late cancellation.`;
}

export function policyLine(freeUntilIso: string, now: Date = new Date()): string {
  return now.getTime() <= new Date(freeUntilIso).getTime()
    ? `Free cancellation until ${formatWhen(freeUntilIso)}`
    : 'Free cancellation has ended for this booking';
}

const EVENT_LABEL: Record<string, string> = {
  created: 'Booked',
  confirmed: 'Confirmed',
  declined: 'Declined',
  expired: 'Request expired',
  cancelled: 'Cancelled',
  rescheduled: 'Moved to a new time',
  checked_in: 'Checked in',
  completed: 'Completed',
  no_show: 'Marked as missed',
  paid: 'Paid (mock)',
  pay_at_visit: 'Paying at the visit',
};

export function eventLabel(event: string, toStatus?: string | null): string {
  if (event === 'created' && toStatus === 'pending_provider') return 'Request sent';
  return EVENT_LABEL[event] ?? event.replace(/_/g, ' ');
}

/** Idempotency key for one booking attempt (8-64 printable characters). */
export function newIdempotencyKey(): string {
  const random = () => Math.random().toString(36).slice(2, 10);
  return `bk-${Date.now().toString(36)}-${random()}${random()}`;
}

export const isUpcoming = (b: Booking) =>
  ['pending_provider', 'confirmed', 'in_progress'].includes(b.status);

/** "Reply by 10:19 pm (1 h 20 min left)" for a request, from the provider's side. */
export function replyBy(deadlineIso: string, now: Date = new Date()): string {
  const left = Math.max(0, Math.round((new Date(deadlineIso).getTime() - now.getTime()) / 60_000));
  const hours = Math.floor(left / 60);
  const minutes = left % 60;
  const remaining =
    left === 0 ? 'time is up' : hours ? `${hours} h ${minutes} min left` : `${minutes} min left`;
  return `Reply by ${formatClock(deadlineIso)} (${remaining})`;
}

/** Section title for a day of appointments: Today, Tomorrow or "Sat, 28 Nov". */
export function dayHeading(iso: string, now: Date = new Date()): string {
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((day(new Date(iso)) - day(now)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDay(iso);
}

/** Groups bookings (already sorted) under day headings, keeping their order. */
export function groupByDay<T extends { start_at: string }>(
  items: T[],
  now: Date = new Date(),
): { title: string; items: T[] }[] {
  const groups: { title: string; items: T[] }[] = [];
  for (const item of items) {
    const title = dayHeading(item.start_at, now);
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.items.push(item);
    else groups.push({ title, items: [item] });
  }
  return groups;
}

export const PROVIDER_REASONS = {
  decline: [
    'Fully booked at that time',
    'Outside my visit area',
    'Not available that day',
    'Needs an in-clinic visit',
  ],
  cancel: ['Vet unavailable', 'Emergency at the clinic', 'Clinic closed unexpectedly'],
} as const;
