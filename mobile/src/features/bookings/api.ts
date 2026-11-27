import { apiClient } from '@/api';

import type { OwnerType } from '@/features/catalog/types';

import type { BookingCreate, BookingDetail, BookingScope } from './types';

type List = { items: BookingDetail[] };

export const createBooking = (
  body: BookingCreate,
  idempotencyKey: string,
): Promise<BookingDetail> =>
  apiClient.request('/bookings', {
    method: 'POST',
    body,
    headers: { 'Idempotency-Key': idempotencyKey },
  });

export const listBookings = (scope: BookingScope): Promise<List> =>
  apiClient.request(`/bookings?scope=${scope}`);

export const getBooking = (id: string): Promise<BookingDetail> =>
  apiClient.request(`/bookings/${id}`);

export const cancelBooking = (id: string, reason?: string): Promise<BookingDetail> =>
  apiClient.request(`/bookings/${id}/cancel`, { method: 'POST', body: reason ? { reason } : {} });

export const rescheduleBooking = (id: string, startAt: string): Promise<BookingDetail> =>
  apiClient.request(`/bookings/${id}/reschedule`, { method: 'POST', body: { start_at: startAt } });

export const payBooking = (
  id: string,
  method: 'pay_now' | 'pay_at_visit',
): Promise<BookingDetail> =>
  apiClient.request(`/bookings/${id}/payment`, { method: 'POST', body: { method } });

// ---- provider side (clinic operators and vets) ----------------------------------

export type InboxScope = 'requests' | 'upcoming' | 'past';
export type ProviderAction = 'confirm' | 'decline' | 'check-in' | 'complete' | 'no-show' | 'cancel';

export const listListingBookings = (
  ownerType: OwnerType,
  ownerId: string,
  scope: InboxScope,
): Promise<List> => apiClient.request(`/manage/${ownerType}/${ownerId}/bookings?scope=${scope}`);

export const providerAction = (
  id: string,
  action: ProviderAction,
  reason?: string,
): Promise<BookingDetail> => {
  const withReason = action === 'decline' || action === 'cancel';
  return apiClient.request(`/bookings/${id}/${action}`, {
    method: 'POST',
    ...(withReason ? { body: reason ? { reason } : {} } : {}),
  });
};
