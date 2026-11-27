import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

import type { IconBadgeTone } from '@/components/ui';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function notificationIcon(kind: string): { icon: IconName; tone: IconBadgeTone } {
  if (kind.startsWith('reminder')) return { icon: 'alarm', tone: 'lavender' };
  switch (kind) {
    case 'booking_request':
      return { icon: 'mail-unread', tone: 'peach' };
    case 'booking_new':
    case 'booking_confirmed':
      return { icon: 'checkmark-circle', tone: 'sage' };
    case 'review_new':
    case 'review_reply':
      return { icon: 'star', tone: 'peach' };
    case 'review_removed':
      return { icon: 'eye-off', tone: 'coral' };
    case 'booking_completed':
      return { icon: 'ribbon', tone: 'sage' };
    case 'booking_rescheduled':
      return { icon: 'swap-horizontal', tone: 'lavender' };
    case 'booking_declined':
    case 'booking_expired':
    case 'booking_cancelled':
    case 'booking_no_show':
      return { icon: 'close-circle', tone: 'coral' };
    default:
      return { icon: 'notifications', tone: 'lavender' };
  }
}

/** "now", "5 min", "3 h", "Yesterday", "Mon 30 Nov". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min`;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(then)) / 86_400_000);
  if (days === 0) return `${Math.floor(minutes / 60)} h`;
  if (days === 1) return 'Yesterday';
  return then.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function sectionFor(iso: string, now: Date = new Date()): 'Today' | 'Earlier' {
  return new Date(iso).toDateString() === now.toDateString() ? 'Today' : 'Earlier';
}
