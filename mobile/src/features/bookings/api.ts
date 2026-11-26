import { apiClient } from '@/api';

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
