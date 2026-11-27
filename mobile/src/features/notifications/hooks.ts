import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/features/auth/session';

import * as api from './api';

export const notificationKeys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread'] as const,
};

const POLL_MS = 60_000;

export function useNotifications() {
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    queryFn: ({ pageParam }) => api.listNotifications(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_before ?? undefined,
  });
}

/** Unread count for the bell badge; polls gently while signed in. */
export function useUnreadCount() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: api.getUnreadCount,
    enabled: signedIn,
    refetchInterval: POLL_MS,
    select: (d) => d.unread_count,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.markAllRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}
