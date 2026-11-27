import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { createQueryClient } from '@/api';
import { completeSignIn, resetSessionForTests } from '@/features/auth/session';
import { dayHeading, groupByDay, replyBy } from '@/features/bookings/format';
import { RootNavigator } from '@/navigation/RootNavigator';

import InboxScreen from '../app/provider/manage/[ownerType]/[id]/bookings';
import ProviderBookingScreen from '../app/provider/booking/[id]';

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
  'provider/manage/[ownerType]/[id]/bookings': InboxScreen,
  'provider/booking/[id]': ProviderBookingScreen,
};

const inAnHour = new Date(Date.now() + 3_600_000).toISOString();

function booking(over: Record<string, unknown> = {}) {
  return {
    id: 'b-1',
    booking_type: 'vet_appointment',
    status: 'pending_provider',
    listing: { kind: 'clinic', id: 'c-1', name: 'Paws & Care Clinic', locality: 'Adyar' },
    service_id: 's-1',
    service_title: 'Home check-up',
    service_mode: 'home_visit',
    confirmation_mode: 'request',
    start_at: '2026-12-01T03:30:00Z',
    end_at: '2026-12-01T04:15:00Z',
    timezone: 'Asia/Kolkata',
    response_deadline: inAnHour,
    amount_minor: 80000,
    currency: 'INR',
    payment_status: 'not_due',
    payment_is_mock: true,
    pets: [{ id: 'p-1', name: 'Kitty', species: 'cat', breed: null }],
    owner_name: 'Lakshmi Iyer',
    owner_notes: 'Very shy',
    visit_address: null,
    policy: {
      free_cancellation_until: '2026-12-01T01:30:00Z',
      free_cancellation_hours_before: 2,
      late_cancellation: 'no_refund',
      provider_cancellation: 'full_refund',
    },
    cancellation_outcome: null,
    cancel_reason: null,
    viewer_role: 'provider',
    allowed_actions: ['confirm', 'decline'],
    created_at: 'x',
    updated_at: 'x',
    events: [
      {
        event: 'created',
        from_status: null,
        to_status: 'pending_provider',
        actor_role: 'owner',
        reason: null,
        details: null,
        created_at: '2026-11-27T10:00:00Z',
      },
    ],
    payments: [],
    ...over,
  };
}

let api: FakeApi;

beforeEach(async () => {
  resetSessionForTests();
  api = createFakeApi();
  globalThis.fetch = api.fetch;
  api.on('GET', '/clinics/c-1', () => [200, { id: 'c-1', name: 'Paws & Care Clinic' }]);
  await completeSignIn({
    ...tokens(1),
    user: { ...USER, display_name: 'Priya' },
    is_new_user: false,
  });
});

describe('provider inbox', () => {
  it('shows requests with a reply-by time and opens one', async () => {
    api.on('GET', '/manage/clinic/c-1/bookings', () => [200, { items: [booking()] }]);
    api.on('GET', '/bookings/b-1', () => [200, booking()]);
    await renderRouter(routes, { initialUrl: '/provider/manage/clinic/c-1/bookings' });

    expect(await screen.findByTestId('reply-by-b-1')).toHaveTextContent(/Reply by .* left\)/);
    expect(screen.getByText('New request')).toBeOnTheScreen();
    expect(screen.getByText('Lakshmi Iyer · Home visit')).toBeOnTheScreen();
    const scopes = api.calls.filter((c) => c.path === '/manage/clinic/c-1/bookings');
    expect(scopes.map((c) => c.query.get('scope')).sort()).toEqual([
      'past',
      'requests',
      'upcoming',
    ]);

    await fireEvent.press(screen.getByTestId('booking-b-1'));
    expect(await screen.findByTestId('provider-booking')).toBeOnTheScreen();
    expect(screen.getByText('Shared with you once you confirm the request.')).toBeOnTheScreen();
  });

  it('confirms a request and reveals the address', async () => {
    let current = booking();
    api.on('GET', '/bookings/b-1', () => [200, current]);
    api.on('POST', '/bookings/b-1/confirm', () => {
      current = booking({
        status: 'confirmed',
        payment_status: 'unpaid',
        visit_address: '12, 2nd Main Road',
        allowed_actions: ['cancel'],
      });
      return [200, current];
    });
    await renderRouter(routes, { initialUrl: '/provider/booking/b-1' });
    await fireEvent.press(await screen.findByTestId('confirm'));
    expect(await screen.findByText('12, 2nd Main Road')).toBeOnTheScreen();
    expect(screen.getByTestId('provider-booking-status')).toHaveTextContent('Confirmed');
    expect(screen.queryByTestId('confirm')).toBeNull();
  });

  it('declines with a reason the parent will see', async () => {
    api.on('GET', '/bookings/b-1', () => [200, booking()]);
    api.on('POST', '/bookings/b-1/decline', (body) => [
      200,
      booking({
        status: 'declined',
        cancel_reason: (body as { reason: string }).reason,
        allowed_actions: [],
      }),
    ]);
    await renderRouter(routes, { initialUrl: '/provider/booking/b-1' });
    await fireEvent.press(await screen.findByTestId('decline'));
    expect(screen.getByTestId('reason-submit')).toBeDisabled();
    await fireEvent.press(screen.getByText('Outside my visit area'));
    await fireEvent.press(screen.getByTestId('reason-submit'));
    await waitFor(() =>
      expect(api.calls.find((c) => c.path === '/bookings/b-1/decline')?.body).toEqual({
        reason: 'Outside my visit area',
      }),
    );
    expect(await screen.findByText('Reason: Outside my visit area')).toBeOnTheScreen();
  });

  it('checks a pet in and completes the visit', async () => {
    let current = booking({ status: 'confirmed', allowed_actions: ['cancel', 'check_in'] });
    api.on('GET', '/bookings/b-1', () => [200, current]);
    api.on('POST', '/bookings/b-1/check-in', () => {
      current = booking({ status: 'in_progress', allowed_actions: ['complete'] });
      return [200, current];
    });
    api.on('POST', '/bookings/b-1/complete', () => {
      current = booking({ status: 'completed', allowed_actions: [] });
      return [200, current];
    });
    await renderRouter(routes, { initialUrl: '/provider/booking/b-1' });
    await fireEvent.press(await screen.findByTestId('check-in'));
    await fireEvent.press(await screen.findByTestId('complete'));
    expect(await screen.findByText(/can now leave a review/)).toBeOnTheScreen();
  });

  it('shows server errors inline', async () => {
    api.on('GET', '/bookings/b-1', () => [200, booking()]);
    api.on('POST', '/bookings/b-1/confirm', () => [
      409,
      { error: { code: 'request_expired', message: 'This request expired.', request_id: 'r' } },
    ]);
    await renderRouter(routes, { initialUrl: '/provider/booking/b-1' });
    await fireEvent.press(await screen.findByTestId('confirm'));
    expect(await screen.findByTestId('action-error')).toBeOnTheScreen();
  });
});

describe('inbox formatting', () => {
  const now = new Date(2026, 10, 27, 22, 0);
  it('groups by day and counts down to the reply deadline', () => {
    const at = (d: number, h: number) => new Date(2026, 10, d, h).toISOString();
    expect(dayHeading(at(27, 23), now)).toBe('Today');
    expect(dayHeading(at(28, 9), now)).toBe('Tomorrow');
    expect(dayHeading(at(26, 9), now)).toBe('Yesterday');
    const groups = groupByDay(
      [{ start_at: at(28, 9) }, { start_at: at(28, 10) }, { start_at: at(30, 9) }],
      now,
    );
    expect(groups.map((g) => [g.title, g.items.length])).toEqual([
      ['Tomorrow', 2],
      [expect.stringMatching(/30 Nov/), 1],
    ]);
    expect(replyBy(new Date(2026, 10, 27, 23, 20).toISOString(), now)).toBe(
      'Reply by 11:20 pm (1 h 20 min left)',
    );
    expect(replyBy(new Date(2026, 10, 27, 21, 0).toISOString(), now)).toMatch(/time is up/);
  });
});
