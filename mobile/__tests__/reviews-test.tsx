import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { createQueryClient } from '@/api';
import { completeSignIn, resetSessionForTests } from '@/features/auth/session';
import { ratingTile } from '@/features/reviews/ReviewsSection';
import { RootNavigator } from '@/navigation/RootNavigator';

import BookingDetailScreen from '../app/bookings/[id]/index';
import ReviewScreen from '../app/bookings/[id]/review';
import ProviderReviewsScreen from '../app/provider/manage/[ownerType]/[id]/reviews';
import ReportScreen from '../app/reviews/[id]/report';

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
  'bookings/[id]/index': BookingDetailScreen,
  'bookings/[id]/review': ReviewScreen,
  'reviews/[id]/report': ReportScreen,
  'provider/manage/[ownerType]/[id]/reviews': ProviderReviewsScreen,
};

const booking = (over: Record<string, unknown> = {}) => ({
  id: 'b-1',
  booking_type: 'vet_appointment',
  status: 'completed',
  listing: { kind: 'clinic', id: 'c-1', name: 'Lotus Pet Clinic', locality: 'Adyar' },
  service_id: 's-1',
  service_title: 'Consultation',
  service_mode: 'in_clinic',
  confirmation_mode: 'instant',
  start_at: '2026-11-26T03:30:00Z',
  end_at: '2026-11-26T04:00:00Z',
  timezone: 'Asia/Kolkata',
  response_deadline: null,
  amount_minor: 50000,
  currency: 'INR',
  payment_status: 'pay_at_visit',
  payment_is_mock: true,
  pets: [{ id: 'p-1', name: 'Mittens', species: 'cat', breed: null }],
  owner_name: null,
  owner_notes: null,
  visit_address: null,
  policy: {
    free_cancellation_until: '2026-11-26T01:30:00Z',
    free_cancellation_hours_before: 2,
    late_cancellation: 'no_refund',
    provider_cancellation: 'full_refund',
  },
  cancellation_outcome: null,
  cancel_reason: null,
  review: null,
  viewer_role: 'owner',
  allowed_actions: ['review'],
  created_at: 'x',
  updated_at: 'x',
  events: [],
  payments: [],
  ...over,
});

const MINE = {
  id: 'r-1',
  booking_id: 'b-1',
  rating: 4,
  text: 'Quick and caring.',
  status: 'published',
  status_note: null,
  can_edit: true,
  edit_until: '2026-12-26T04:00:00Z',
  created_at: '2026-11-27T10:00:00Z',
  edited: false,
  reply: null,
};

let api: FakeApi;

beforeEach(async () => {
  resetSessionForTests();
  api = createFakeApi();
  globalThis.fetch = api.fetch;
  await completeSignIn({
    ...tokens(1),
    user: { ...USER, display_name: 'Priya' },
    is_new_user: false,
  });
});

describe('reviews', () => {
  it('invites a review on a completed visit and posts it', async () => {
    let current = booking();
    api.on('GET', '/bookings/b-1', () => [200, current]);
    api.on('POST', '/bookings/b-1/review', (body) => {
      current = booking({ review: { ...MINE, ...(body as object) }, allowed_actions: [] });
      return [201, current.review];
    });

    await renderRouter(routes, { initialUrl: '/bookings/b-1' });
    await fireEvent.press(await screen.findByTestId('review-start'));
    expect(await screen.findByTestId('review-screen')).toBeOnTheScreen();
    expect(screen.getByTestId('review-submit')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('rating-4'));
    expect(screen.getByText('Very good')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('review-text'), '  Quick and caring. ');
    await fireEvent.press(screen.getByTestId('review-submit'));

    await waitFor(() =>
      expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
        rating: 4,
        text: 'Quick and caring.',
      }),
    );
    expect(await screen.findByTestId('my-review')).toHaveTextContent(/Quick and caring\./);
    expect(screen.getByTestId('review-edit')).toBeOnTheScreen();
  });

  it('explains when a review is held', async () => {
    api.on('GET', '/bookings/b-1', () => [
      200,
      booking({
        allowed_actions: [],
        review: {
          ...MINE,
          status: 'pending',
          status_note: 'Hidden while our team looks at a report.',
        },
      }),
    ]);
    await renderRouter(routes, { initialUrl: '/bookings/b-1' });
    expect(await screen.findByTestId('my-review-note')).toHaveTextContent(/looks at a report/);
    expect(screen.getByText('Hidden for now')).toBeOnTheScreen();
  });

  it('reports a review with a reason', async () => {
    api.on('POST', '/reviews/r-9/report', () => [204, undefined]);
    await renderRouter(routes, { initialUrl: '/reviews/r-9/report' });
    expect(await screen.findByTestId('report-submit')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('reason-fake'));
    await fireEvent.press(screen.getByTestId('report-submit'));
    expect(await screen.findByTestId('report-done')).toBeOnTheScreen();
    expect(api.calls.find((c) => c.method === 'POST')?.body).toEqual({
      reason: 'fake',
      note: null,
    });
  });

  it('lets the provider reply publicly', async () => {
    const review = {
      id: 'r-1',
      rating: 5,
      text: 'So gentle with Bruno.',
      author_name: 'Arun K.',
      pets: 'Dog',
      service_title: 'Consultation',
      created_at: '2026-11-27T10:00:00Z',
      edited: false,
      reply: null as { text: string; replied_at: string } | null,
      is_mine: false,
      status: 'published',
      can_reply: true,
    };
    api.on('GET', '/manage/clinic/c-1/reviews', () => [
      200,
      { summary: { rating: 5, review_count: 1 }, items: [review] },
    ]);
    api.on('PUT', '/reviews/r-1/reply', (body) => {
      review.reply = { text: (body as { text: string }).text, replied_at: 'x' };
      return [200, review];
    });
    await renderRouter(routes, { initialUrl: '/provider/manage/clinic/c-1/reviews' });
    expect(await screen.findByText('So gentle with Bruno.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('reply-open-r-1'));
    await fireEvent.changeText(screen.getByTestId('reply-text-r-1'), 'Thank you, Arun!');
    await fireEvent.press(screen.getByTestId('reply-send-r-1'));
    expect(await screen.findByText('Thank you, Arun!')).toBeOnTheScreen();
    expect(screen.getByText('1/1')).toBeOnTheScreen();
  });

  it('formats the rating tile', () => {
    expect(ratingTile(4.75, 12)).toEqual({ value: '★ 4.8', label: '12 reviews' });
    expect(ratingTile(5, 1)).toEqual({ value: '★ 5.0', label: '1 review' });
    expect(ratingTile(null, 0)).toEqual({ value: 'New', label: 'No reviews yet' });
  });
});
