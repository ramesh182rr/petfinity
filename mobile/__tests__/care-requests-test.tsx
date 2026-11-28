import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Alert, Text } from 'react-native';

import { createQueryClient } from '@/api';
import { completeSignIn, resetSessionForTests } from '@/features/auth/session';
import { closesLabel } from '@/features/care/format';
import {
  buildRequest,
  defaultsFor,
  estimateUnits,
  type CareForm,
} from '@/features/care/requestForm';
import { RootNavigator } from '@/navigation/RootNavigator';

import CareRequestScreen from '../app/care/[id]';
import CaretakerRequestScreen from '../app/provider/care/[id]/request/[rid]';
import CareFeedScreen from '../app/provider/care/[id]/requests';

import { createFakeApi, tokens, USER, type FakeApi } from './helpers/fakeApi';

function Root() {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <RootNavigator />
    </QueryClientProvider>
  );
}

const BookingStub = () => <Text testID="booking-stub">booking</Text>;

const routes = {
  _layout: Root,
  index: () => null,
  'care/[id]': CareRequestScreen,
  'bookings/[id]/index': BookingStub,
  'provider/care/[id]/requests': CareFeedScreen,
  'provider/care/[id]/request/[rid]': CaretakerRequestScreen,
};

const later = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const PET = {
  id: 'pet-1',
  name: 'Bruno',
  species: 'dog',
  breed: null,
  age_years: 4,
  weight_kg: 20,
  sex: 'male',
  neutered: true,
  temperament: 'Friendly',
};

const OFFER = {
  id: 'of-1',
  price_minor: 280000,
  message: 'Happy to have Bruno.',
  status: 'pending',
  created_at: 'x',
  updated_at: 'x',
  caretaker: {
    id: 'ct-9',
    display_name: 'Meena Subramanian',
    bio: null,
    years_experience: 6,
    languages: ['Tamil'],
    area_name: 'Chennai',
    home_type: 'independent_house',
    outdoor_space: true,
    pets_at_home: null,
    verified_at: '2026-11-20T10:00:00Z',
    rating: 4.8,
    review_count: 12,
    completed_care: 9,
    rate_minor: 90000,
  },
};

const REQUEST = {
  id: 'req-1',
  care_type: 'boarding',
  status: 'open',
  start_at: later(72),
  end_at: later(144),
  visits_per_day: null,
  units: 3,
  unit: 'night',
  area_key: 'chennai',
  area_name: 'Chennai',
  locality: 'Adyar',
  latitude: null,
  longitude: null,
  address: null,
  notes: null,
  budget_minor: 300000,
  pets: [PET],
  offers: [OFFER],
  offer_count: 1,
  offers_close_at: later(23),
  accepting_offers: true,
  booking_id: null,
  created_at: 'x',
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

afterEach(() => jest.restoreAllMocks());

describe('parent: compare and accept', () => {
  it('books the chosen offer and opens the booking', async () => {
    api.on('GET', '/care-requests/req-1', () => [200, REQUEST]);
    api.on('POST', '/care-requests/req-1/offers/of-1/accept', () => [200, { id: 'bk-1' }]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Book')?.onPress?.();
    });

    await renderRouter(routes, { initialUrl: '/care/req-1' });
    expect(await screen.findByTestId('care-compare')).toBeOnTheScreen();
    expect(screen.getByTestId('offer-of-1')).toHaveTextContent(/Meena Subramanian/);
    await fireEvent.press(screen.getByTestId('accept-of-1'));

    expect(alert.mock.calls[0]?.[1]).toMatch(/Free cancellation until 48 hours/);
    expect(await screen.findByTestId('booking-stub')).toBeOnTheScreen();
    expect(api.calls.some((c) => c.method === 'POST' && c.path.endsWith('/accept'))).toBe(true);
  });

  it('shows the waiting state with no offers', async () => {
    api.on('GET', '/care-requests/req-1', () => [200, { ...REQUEST, offers: [], offer_count: 0 }]);
    await renderRouter(routes, { initialUrl: '/care/req-1' });
    expect(await screen.findByTestId('care-waiting')).toBeOnTheScreen();
  });
});

const FEED_ITEM = {
  id: 'req-2',
  care_type: 'home_visit',
  status: 'open',
  start_at: later(48),
  end_at: later(96),
  visits_per_day: 2,
  units: 6,
  unit: 'visit',
  area_name: 'Chennai',
  locality: 'Besant Nagar',
  distance_km: 9,
  notes: 'Walk him twice.',
  budget_minor: 200000,
  pets: [PET],
  offer_count: 0,
  offers_close_at: later(23),
  accepting_offers: true,
  booking_id: null,
  my_offer: null,
  suggested_price_minor: 180000,
};

describe('caretaker: feed and offers', () => {
  const base = '/manage/provider_profile/ct-1/care/requests';

  it('lists open requests and sends an offer', async () => {
    let item: Record<string, unknown> = FEED_ITEM;
    api.on('GET', base, () => [200, { items: [item] }]);
    api.on('GET', `${base}/req-2`, () => [200, item]);
    api.on('PUT', `${base}/req-2/offer`, (body) => {
      const b = body as { price_minor: number; message: string | null };
      item = {
        ...FEED_ITEM,
        offer_count: 1,
        my_offer: { id: 'of-2', ...b, status: 'pending', updated_at: 'x' },
      };
      return [200, item];
    });

    await renderRouter(routes, { initialUrl: '/provider/care/ct-1/requests' });
    expect(await screen.findByTestId('feed-req-2')).toHaveTextContent(/Besant Nagar/);
    await fireEvent.press(screen.getByTestId('feed-req-2'));

    const price = await screen.findByTestId('offer-price');
    expect(price.props.value).toBe('1800');
    await fireEvent.changeText(price, '1,7a00');
    await fireEvent.changeText(screen.getByTestId('offer-message'), 'I live nearby.');
    await fireEvent.press(screen.getByTestId('offer-send'));

    await waitFor(() =>
      expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
        price_minor: 170000,
        message: 'I live nearby.',
      }),
    );
    expect(await screen.findByText('You offered ₹1,700')).toBeOnTheScreen();
    expect(screen.getByTestId('offer-withdraw')).toBeOnTheScreen();
  });

  it('asks unverified caretakers to get verified', async () => {
    api.on('GET', base, () => [
      403,
      { error: { code: 'not_verified', message: 'Not verified', request_id: 'r' } },
    ]);
    await renderRouter(routes, { initialUrl: '/provider/care/ct-1/requests' });
    expect(await screen.findByText('Get verified to see requests')).toBeOnTheScreen();
  });
});

describe('request form', () => {
  const today = new Date(2026, 10, 28, 10, 0);
  const form = (patch: Partial<CareForm> = {}): CareForm => ({
    ...defaultsFor('boarding', today),
    petIds: ['pet-1'],
    areaKey: 'chennai',
    latitude: null,
    longitude: null,
    locality: 'Adyar',
    address: '',
    notes: '',
    budget: '',
    ...patch,
  });

  it('estimates units like the API', () => {
    expect(estimateUnits(form())).toBe('3 nights');
    expect(estimateUnits(form(defaultsFor('home_visit', today)))).toBe('6 visits');
    expect(estimateUnits(form(defaultsFor('day_care', today)))).toBe('1 day');
  });

  it('validates and builds the request body', () => {
    const bad = buildRequest(form({ petIds: [], locality: '', areaKey: null }));
    expect(bad.ok).toBe(false);
    expect(!bad.ok && Object.keys(bad.errors).sort()).toEqual(['area', 'locality', 'pets']);

    const sitting = buildRequest(form({ ...defaultsFor('house_sitting', today), address: '' }));
    expect(!sitting.ok && sitting.errors.address).toBe('Add the full address.');

    const ok = buildRequest(form({ budget: '3000', notes: '  ' }));
    expect(ok.ok && ok.body).toMatchObject({
      care_type: 'boarding',
      pet_ids: ['pet-1'],
      visits_per_day: null,
      address: null,
      notes: null,
      budget_minor: 300000,
    });
  });

  it('needs at least one night for overnight care', () => {
    const d = new Date(2026, 11, 1);
    const r = buildRequest(
      form({ startDate: d, endDate: d, startTime: '08:00', endTime: '20:00' }),
    );
    expect(!r.ok && r.errors.dates).toBe('Overnight care needs at least one night.');
  });

  it('formats when offers close', () => {
    const now = new Date('2026-11-28T10:00:00Z');
    expect(closesLabel('2026-11-29T10:00:00Z', true, now)).toBe('Offers close in 24 h');
    expect(closesLabel('2026-11-28T11:30:00Z', true, now)).toBe('Offers close in 1 h 30 min');
    expect(closesLabel('2026-11-28T10:20:00Z', true, now)).toBe('Offers close in 20 min');
    expect(closesLabel('2026-11-29T10:00:00Z', false, now)).toBe('No longer taking new offers');
  });
});
