import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as api from './api';
import type { OwnerType } from '@/features/catalog/types';

import type { BookingCreate, BookingDetail, BookingScope } from './types';

export const bookingKeys = {
  all: ['bookings'] as const,
  list: (scope: BookingScope) => ['bookings', 'list', scope] as const,
  detail: (id: string) => ['bookings', 'detail', id] as const,
  inbox: (ownerType: OwnerType, ownerId: string, scope: api.InboxScope) =>
    ['bookings', 'inbox', ownerType, ownerId, scope] as const,
};

export const useBookings = (scope: BookingScope) =>
  useQuery({ queryKey: bookingKeys.list(scope), queryFn: () => api.listBookings(scope) });

export const useBooking = (id: string) =>
  useQuery({ queryKey: bookingKeys.detail(id), queryFn: () => api.getBooking(id) });

/** After any change: cache the fresh detail, refresh lists and open times. */
function useOnChanged() {
  const qc = useQueryClient();
  return (booking: BookingDetail) => {
    qc.setQueryData(bookingKeys.detail(booking.id), booking);
    void qc.invalidateQueries({ queryKey: ['bookings', 'list'] });
    void qc.invalidateQueries({ queryKey: ['bookings', 'inbox'] });
    void qc.invalidateQueries({ queryKey: ['discover'] });
  };
}

export function useCreateBooking() {
  const onChanged = useOnChanged();
  return useMutation({
    mutationFn: ({ body, key }: { body: BookingCreate; key: string }) =>
      api.createBooking(body, key),
    onSuccess: onChanged,
  });
}

export function useCancelBooking(id: string) {
  const onChanged = useOnChanged();
  return useMutation({
    mutationFn: (reason?: string) => api.cancelBooking(id, reason),
    onSuccess: onChanged,
  });
}

export function useRescheduleBooking(id: string) {
  const onChanged = useOnChanged();
  return useMutation({
    mutationFn: (startAt: string) => api.rescheduleBooking(id, startAt),
    onSuccess: onChanged,
  });
}

export function usePayBooking(id: string) {
  const onChanged = useOnChanged();
  return useMutation({
    mutationFn: (method: 'pay_now' | 'pay_at_visit') => api.payBooking(id, method),
    onSuccess: onChanged,
  });
}

export const useListingBookings = (ownerType: OwnerType, ownerId: string, scope: api.InboxScope) =>
  useQuery({
    queryKey: bookingKeys.inbox(ownerType, ownerId, scope),
    queryFn: () => api.listListingBookings(ownerType, ownerId, scope),
  });

/** Confirm, decline, check in, complete, no-show or cancel (provider). */
export function useProviderAction(id: string) {
  const onChanged = useOnChanged();
  return useMutation({
    mutationFn: ({ action, reason }: { action: api.ProviderAction; reason?: string }) =>
      api.providerAction(id, action, reason),
    onSuccess: onChanged,
  });
}
