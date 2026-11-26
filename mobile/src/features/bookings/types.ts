import type { components } from '@/api/generated/schema';

type S = components['schemas'];
export type Booking = S['BookingOut'];
export type BookingDetail = S['BookingDetail'];
export type BookingCreate = S['BookingCreate'];
export type BookingStatus = S['BookingStatus'];
export type BookingAction = S['BookingAction'];
export type PaymentStatus = S['PaymentStatus'];
export type BookingEvent = S['BookingEventOut'];
export type BookingScope = 'upcoming' | 'past';
