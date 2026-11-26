import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { createQueryClient } from '@/api';
import { completeSignIn, resetSessionForTests } from '@/features/auth/session';
import { resetDiscoveryForTests } from '@/features/discovery/store';
import { RootNavigator } from '@/navigation/RootNavigator';

import BookingsScreen from '../app/(tabs)/bookings';
import BookReviewScreen from '../app/book/index';
import BookingDetailScreen from '../app/bookings/[id]/index';
import RescheduleScreen from '../app/bookings/[id]/reschedule';

import { createFakeApi, tokens, USER, type FakeApi } from './helpers/fakeApi';

function Root() {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <RootNavigator />
    </QueryClientProvider>
  );
}

const routes = {
  _layout: Root,
  index: () => null,
  'bookings/index': BookingsScreen,
  'book/index': BookReviewScreen,
  'bookings/[id]/index': BookingDetailScreen,
  'bookings/[id]/reschedule': RescheduleScreen,
};

const START = '2026-12-01T03:30:00Z';
const SERVICE = {
  id: 's-1',
  category: 'general_consultation',
  title: 'Consultation',
  description: null,
  price_minor: 50000,
  currency: 'INR',
  duration_minutes: 30,
  service_mode: 'in_clinic',
  confirmation_mode: 'instant',
  species: ['cat', 'dog'],
};
const CLINIC = {
  id: 'c-1',
  name: 'Lotus Pet Clinic',
  description: null,
  address_line1: '1, Lake Road',
  address_line2: null,
  locality: 'Adyar',
  city: 'Chennai',
  state: 'Tamil Nadu',
  postal_code: '600020',
  latitude: null,
  longitude: null,
  distance_km: null,
  distance_is_approximate: false,
  area_name: 'Chennai',
  timezone: 'Asia/Kolkata',
  emergency_services: false,
  badge: { verified_at: null, checks: [] },
  open_now: true,
  hours: [],
  closures: [],
  services: [SERVICE],
  doctors: [],
};
const pet = (id: string, name: string, species: string) => ({
  id,
  name,
  species,
  species_other: null,
  breed: null,
  sex: 'unknown',
  date_of_birth: null,
  date_of_birth_is_estimate: false,
  weight_kg: null,
  neutered: null,
  temperament: null,
  dietary_notes: null,
  allergies: null,
  known_conditions: null,
  medications: null,
  emergency_contact_name: null,
  emergency_contact_phone: null,
  photo: null,
  created_at: 'x',
  updated_at: 'x',
});

function booking(over: Record<string, unknown> = {}) {
  return {
    id: 'b-1',
    booking_type: 'vet_appointment',
    status: 'confirmed',
    listing: { kind: 'clinic', id: 'c-1', name: 'Lotus Pet Clinic', locality: 'Adyar' },
    service_id: 's-1',
    service_title: 'Consultation',
    service_mode: 'in_clinic',
    confirmation_mode: 'instant',
    start_at: START,
    end_at: '2026-12-01T04:00:00Z',
    timezone: 'Asia/Kolkata',
    response_deadline: null,
    amount_minor: 50000,
    currency: 'INR',
    payment_status: 'unpaid',
    payment_is_mock: true,
    pets: [{ id: 'p-1', name: 'Mittens', species: 'cat', breed: null }],
    owner_name: null,
    owner_notes: null,
    visit_address: null,
    policy: {
      free_cancellation_until: '2026-12-01T01:30:00Z',
      free_cancellation_hours_before: 2,
      late_cancellation: 'no_refund',
      provider_cancellation: 'full_refund',
    },
    cancellation_outcome: null,
    cancel_reason: null,
    viewer_role: 'owner',
    allowed_actions: ['cancel', 'reschedule', 'pay', 'pay_at_visit'],
    created_at: '2026-11-26T10:00:00Z',
    updated_at: '2026-11-26T10:00:00Z',
    events: [
      {
        event: 'created',
        from_status: null,
        to_status: 'confirmed',
        actor_role: 'owner',
        reason: null,
        details: null,
        created_at: '2026-11-26T10:00:00Z',
      },
    ],
    payments: [],
    ...over,
  };
}

let api: FakeApi;

beforeEach(async () => {
  resetSessionForTests();
  resetDiscoveryForTests();
  api = createFakeApi();
  globalThis.fetch = api.fetch;
  await completeSignIn({
    ...tokens(1),
    user: { ...USER, display_name: 'Priya' },
    is_new_user: false,
  });
});

const reviewUrl = `/book?kind=clinic&listingId=c-1&serviceId=s-1&start=${encodeURIComponent(START)}`;

describe('booking flow', () => {
  it('reviews, books with an idempotency key and pays (mock)', async () => {
    let current = booking();
    api.on('GET', '/discover/clinics/c-1', () => [200, CLINIC]);
    api.on('GET', '/pets', () => [
      200,
      [pet('p-1', 'Mittens', 'cat'), pet('p-2', 'Hopper', 'rabbit')],
    ]);
    api.on('POST', '/bookings', () => [201, current]);
    api.on('GET', '/bookings/b-1', () => [200, current]);
    api.on('POST', '/bookings/b-1/payment', (body) => {
      current = booking({
        payment_status: (body as { method: string }).method === 'pay_now' ? 'paid' : 'pay_at_visit',
        allowed_actions: ['cancel', 'reschedule'],
      });
      return [200, current];
    });

    await renderRouter(routes, { initialUrl: reviewUrl });
    expect(await screen.findByTestId('book-review')).toBeOnTheScreen();
    // The rabbit can't be booked for a cat/dog service.
    expect(screen.getByTestId('book-pet-p-2')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('book-pet-p-1'));
    await fireEvent.changeText(screen.getByTestId('book-notes'), '  Sneezing ');
    await fireEvent.press(screen.getByTestId('book-submit'));

    expect(await screen.findByText('You’re booked!')).toBeOnTheScreen();
    const post = api.calls.find((c) => c.method === 'POST' && c.path === '/bookings');
    expect(post?.headers['Idempotency-Key']).toMatch(/^bk-/);
    expect(post?.body).toEqual({
      listing_kind: 'clinic',
      listing_id: 'c-1',
      service_id: 's-1',
      start_at: START,
      pet_ids: ['p-1'],
      owner_notes: 'Sneezing',
      visit_address: null,
    });

    await fireEvent.press(screen.getByTestId('pay-now'));
    await waitFor(() =>
      expect(screen.getByTestId('payment-status')).toHaveTextContent('Paid (mock)'),
    );
    expect(screen.queryByTestId('pay-now')).toBeNull();
  });

  it('shows a friendly conflict when the slot was just taken', async () => {
    api.on('GET', '/discover/clinics/c-1', () => [200, CLINIC]);
    api.on('GET', '/pets', () => [200, [pet('p-1', 'Mittens', 'cat')]]);
    api.on('POST', '/bookings', () => [
      409,
      { error: { code: 'slot_unavailable', message: 'taken', request_id: 'r' } },
    ]);
    await renderRouter(routes, { initialUrl: reviewUrl });
    await fireEvent.press(await screen.findByTestId('book-submit'));
    expect(await screen.findByTestId('slot-conflict')).toBeOnTheScreen();
    expect(screen.getByTestId('book-submit')).toBeDisabled();
  });

  it('requires an address for home visits and sends a request', async () => {
    const home = { ...SERVICE, service_mode: 'home_visit', confirmation_mode: 'request' };
    api.on('GET', '/discover/vets/v-1', () => [
      200,
      {
        id: 'v-1',
        display_name: 'Dr. Ananya Rao',
        bio: null,
        qualifications: null,
        years_experience: 9,
        languages: [],
        area_name: 'Chennai',
        service_radius_km: 10,
        visits_you: true,
        timezone: 'Asia/Kolkata',
        badge: { verified_at: null, checks: [] },
        open_now: false,
        hours: [],
        closures: [],
        services: [home],
        clinics: [],
      },
    ]);
    api.on('GET', '/pets', () => [200, [pet('p-1', 'Mittens', 'cat')]]);
    api.on('POST', '/bookings', () => [
      201,
      booking({
        status: 'pending_provider',
        service_mode: 'home_visit',
        confirmation_mode: 'request',
        response_deadline: '2026-11-26T12:00:00Z',
        payment_status: 'not_due',
        allowed_actions: ['cancel', 'reschedule'],
        listing: { kind: 'vet', id: 'v-1', name: 'Dr. Ananya Rao', locality: 'Chennai' },
      }),
    ]);
    api.on('GET', '/bookings/b-1', () => [200, booking({ status: 'pending_provider' })]);

    await renderRouter(routes, {
      initialUrl: `/book?kind=vet&listingId=v-1&serviceId=s-1&start=${encodeURIComponent(START)}`,
    });
    expect(await screen.findByText('Send request')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('book-submit'));
    expect(await screen.findByText('Add the full address for the home visit.')).toBeOnTheScreen();
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);

    await fireEvent.changeText(screen.getByTestId('book-address'), '4, Beach Road, Adyar');
    await fireEvent.press(screen.getByTestId('book-submit'));
    expect(await screen.findByText('Request sent')).toBeOnTheScreen();
    expect(api.calls.find((c) => c.method === 'POST')?.body).toMatchObject({
      listing_kind: 'vet',
      visit_address: '4, Beach Road, Adyar',
    });
    expect(screen.queryByTestId('payment-card')).toBeNull(); // nothing to pay until confirmed
  });

  it('lists appointments and opens one', async () => {
    api.on('GET', '/bookings', () => [200, { items: [booking()] }]);
    api.on('GET', '/bookings/b-1', () => [200, booking()]);
    await renderRouter(routes, { initialUrl: '/bookings' });
    expect(await screen.findByText('1 upcoming appointment')).toBeOnTheScreen();
    expect(api.calls.find((c) => c.path === '/bookings')?.query.get('scope')).toBe('upcoming');
    await fireEvent.press(screen.getByTestId('booking-b-1'));
    expect(await screen.findByTestId('booking-detail')).toBeOnTheScreen();
    expect(screen.getByTestId('booking-status')).toHaveTextContent('Confirmed');
  });

  it('explains the outcome before cancelling', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    api.on('GET', '/bookings/b-1', () => [200, booking({ payment_status: 'paid' })]);
    api.on('POST', '/bookings/b-1/cancel', () => [
      200,
      booking({
        status: 'cancelled_by_owner',
        cancellation_outcome: 'full_refund',
        payment_status: 'refunded',
        allowed_actions: [],
      }),
    ]);
    await renderRouter(routes, { initialUrl: '/bookings/b-1' });
    await fireEvent.press(await screen.findByTestId('cancel'));
    expect(alert).toHaveBeenCalled();
    const [, message, buttons] = alert.mock.calls[0] ?? [];
    expect(String(message)).toMatch(/refunded|late cancellation/);
    const confirm = (buttons as { text: string; onPress?: () => void }[]).find(
      (b) => b.text === 'Cancel appointment',
    );
    confirm?.onPress?.();
    expect(await screen.findByText(/refunded in full/)).toBeOnTheScreen();
    expect(screen.queryByTestId('cancel')).toBeNull();
  });

  it('moves an appointment to another open time', async () => {
    api.on('GET', '/bookings/b-1', () => [200, booking()]);
    api.on('GET', '/discover/clinics/c-1/slots', () => [
      200,
      {
        date: '2026-12-01',
        timezone: 'Asia/Kolkata',
        service_id: 's-1',
        slots: [
          { start: START, end: '2026-12-01T04:00:00Z', local_start: '09:00' },
          { start: '2026-12-01T10:30:00Z', end: '2026-12-01T11:00:00Z', local_start: '16:00' },
        ],
      },
    ]);
    api.on('POST', '/bookings/b-1/reschedule', (body) => [
      200,
      booking({ start_at: (body as { start_at: string }).start_at }),
    ]);
    await renderRouter(routes, { initialUrl: '/bookings/b-1/reschedule' });
    expect(await screen.findByText('4:00 pm')).toBeOnTheScreen();
    expect(screen.queryByText('9:00 am')).toBeNull(); // the current time isn't offered
    await fireEvent.press(screen.getByText('4:00 pm'));
    await fireEvent.press(screen.getByTestId('reschedule-submit'));
    await waitFor(() =>
      expect(api.calls.find((c) => c.path === '/bookings/b-1/reschedule')?.body).toEqual({
        start_at: '2026-12-01T10:30:00Z',
      }),
    );
  });
});
