import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { createQueryClient } from '@/api';
import { completeSignIn, resetSessionForTests } from '@/features/auth/session';
import { resetDiscoveryForTests, useDiscoveryStore } from '@/features/discovery/store';
import { RootNavigator } from '@/navigation/RootNavigator';

import DiscoverScreen from '../app/(tabs)/discover';
import AreaScreen from '../app/discover/area';
import ClinicListingScreen from '../app/discover/clinic/[id]';
import VetListingScreen from '../app/discover/vet/[id]';

import { createFakeApi, tokens, USER, type FakeApi } from './helpers/fakeApi';

jest.mock('@/features/discovery/location', () => ({
  ...jest.requireActual('@/features/discovery/location'),
  getDeviceLocation: jest.fn(async () => ({
    ok: true,
    location: { latitude: 13.0067, longitude: 80.2575 },
  })),
}));

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
  'discover/index': DiscoverScreen,
  'discover/area': AreaScreen,
  'discover/clinic/[id]': ClinicListingScreen,
  'discover/vet/[id]': VetListingScreen,
};

const AREAS = {
  areas: [
    { key: 'chennai', name: 'Chennai', state: 'Tamil Nadu', latitude: 13.08, longitude: 80.27 },
    { key: 'kochi', name: 'Kochi', state: 'Kerala', latitude: 9.93, longitude: 76.27 },
  ],
  default_radius_km: 10,
  max_radius_km: 25,
  service_radius_choices_km: [5, 10, 15, 25],
};

const LISTING = {
  kind: 'clinic',
  id: 'c-1',
  name: 'Lotus Pet Clinic',
  subtitle: 'Adyar, Chennai',
  area_name: 'Chennai',
  distance_km: 2.4,
  distance_is_approximate: false,
  service_radius_km: null,
  verified_at: '2026-11-20T10:00:00Z',
  emergency: false,
  modes: ['in_clinic'],
  categories: ['general_consultation', 'vaccination'],
  price_from_minor: 50000,
  service_count: 2,
  open_now: true,
  next_slot_at: null,
  languages: [],
  years_experience: null,
};

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

const WEEK = Array.from({ length: 7 }, (_, weekday) => ({
  weekday,
  ranges: weekday < 6 ? [{ start_time: '09:00:00', end_time: '13:00:00' }] : [],
}));

const CLINIC = {
  id: 'c-1',
  name: 'Lotus Pet Clinic',
  description: 'Friendly neighbourhood clinic.',
  address_line1: '1, Lake Road',
  address_line2: null,
  locality: 'Adyar',
  city: 'Chennai',
  state: 'Tamil Nadu',
  postal_code: '600020',
  latitude: 13.0067,
  longitude: 80.2575,
  distance_km: 2.4,
  distance_is_approximate: false,
  area_name: 'Chennai',
  timezone: 'Asia/Kolkata',
  emergency_services: false,
  badge: { verified_at: '2026-11-20T10:00:00Z', checks: ['Business registration'] },
  open_now: true,
  hours: WEEK,
  closures: [{ on_date: '2026-12-01', kind: 'closed', start_time: null, end_time: null }],
  services: [SERVICE],
  doctors: [
    {
      id: 'v-1',
      display_name: 'Dr. Priya Nair',
      qualifications: 'B.V.Sc.',
      years_experience: 8,
      languages: ['Tamil'],
    },
  ],
};

let api: FakeApi;

beforeEach(async () => {
  resetSessionForTests();
  resetDiscoveryForTests();
  api = createFakeApi();
  globalThis.fetch = api.fetch;
  api.on('GET', '/discover/areas', () => [200, AREAS]);
  await completeSignIn({
    ...tokens(1),
    user: { ...USER, display_name: 'Priya' },
    is_new_user: false,
  });
});

const searches = () => api.calls.filter((c) => c.path === '/discover/search');

describe('discover', () => {
  it('asks for a location, then searches the chosen city and filters', async () => {
    api.on('GET', '/discover/search', () => [
      200,
      {
        items: [LISTING],
        total: 1,
        origin: { latitude: 13.08, longitude: 80.27, area_key: 'chennai', label: 'Chennai' },
        radius_km: 10,
      },
    ]);
    await renderRouter(routes, { initialUrl: '/discover' });

    expect(await screen.findByTestId('choose-location')).toBeOnTheScreen();
    expect(searches()).toHaveLength(0); // nothing is searched without a location

    await fireEvent.press(screen.getByTestId('choose-area'));
    await fireEvent.press(await screen.findByTestId('area-chennai'));

    expect(await screen.findByTestId('listing-c-1')).toBeOnTheScreen();
    expect(screen.getByTestId('results-count')).toHaveTextContent('1 verified listing');
    expect(screen.getByText('Adyar, Chennai · 2.4 km')).toBeOnTheScreen();
    expect(searches()[0]?.query.get('area')).toBe('chennai');
    expect(searches()[0]?.query.get('radius_km')).toBe('10');

    await fireEvent.press(screen.getByTestId('filter-open-now'));
    await waitFor(() => expect(searches().at(-1)?.query.get('open_now')).toBe('true'));

    await fireEvent.changeText(screen.getByTestId('search-input'), 'lotus');
    await waitFor(() => expect(searches().at(-1)?.query.get('q')).toBe('lotus'), {
      timeout: 2000,
    });
  });

  it('uses the device location and offers a wider radius when empty', async () => {
    api.on('GET', '/discover/search', () => [
      200,
      {
        items: [],
        total: 0,
        origin: { latitude: 13.0067, longitude: 80.2575, area_key: null, label: 'Near you' },
        radius_km: 10,
      },
    ]);
    await renderRouter(routes, { initialUrl: '/discover' });
    await fireEvent.press(await screen.findByTestId('use-location'));

    expect(await screen.findByTestId('no-results')).toBeOnTheScreen();
    expect(searches()[0]?.query.get('lat')).toBe('13.0067');
    expect(searches()[0]?.query.has('area')).toBe(false);

    await fireEvent.press(screen.getByText('Search within 25 km'));
    await waitFor(() => expect(searches().at(-1)?.query.get('radius_km')).toBe('25'));
    expect(useDiscoveryStore.getState().filters.radiusKm).toBe(25);
  });

  it('shows a verified clinic with services, times, vets and hours', async () => {
    useDiscoveryStore.getState().setOrigin({ type: 'area', key: 'chennai', name: 'Chennai' });
    api.on('GET', '/discover/clinics/c-1', () => [200, CLINIC]);
    api.on('GET', '/discover/clinics/c-1/slots', () => [
      200,
      {
        date: '2026-11-26',
        timezone: 'Asia/Kolkata',
        service_id: 's-1',
        slots: [
          { start: '2026-11-26T03:30:00Z', end: '2026-11-26T04:00:00Z', local_start: '09:00' },
        ],
      },
    ]);
    await renderRouter(routes, { initialUrl: '/discover/clinic/c-1' });

    expect(await screen.findByTestId('clinic-listing')).toBeOnTheScreen();
    expect(screen.getByTestId('verified-badge')).toHaveTextContent(/Business registration/);
    expect(screen.getByText('Dr. Priya Nair')).toBeOnTheScreen();
    expect(screen.getByTestId('public-hours')).toHaveTextContent(/Closed/);
    expect(await screen.findByText('9:00 am')).toBeOnTheScreen();
    expect(api.calls.find((c) => c.path === '/discover/clinics/c-1')?.query.get('area')).toBe(
      'chennai',
    );
    const slotCall = api.calls.find((c) => c.path === '/discover/clinics/c-1/slots');
    expect(slotCall?.query.get('service_id')).toBe('s-1');
    // Booking arrives in 2.7: the button is visible but disabled.
    expect(screen.getByTestId('book-cta')).toBeDisabled();
    expect(screen.queryByText(/\+91/)).toBeNull(); // no contact details on the public page
  });

  it('explains when a listing is no longer available', async () => {
    await renderRouter(routes, { initialUrl: '/discover/vet/v-9' });
    expect(await screen.findByText("This vet isn't listed right now")).toBeOnTheScreen();
  });

  it('tells a parent whether a home-visit vet reaches them', async () => {
    useDiscoveryStore
      .getState()
      .setOrigin({ type: 'device', latitude: 13.0067, longitude: 80.2575 });
    api.on('GET', '/discover/vets/v-1', () => [
      200,
      {
        id: 'v-1',
        display_name: 'Dr. Ananya Rao',
        bio: null,
        qualifications: 'B.V.Sc.',
        years_experience: 9,
        languages: ['Tamil', 'English'],
        area_name: 'Chennai',
        service_radius_km: 10,
        visits_you: false,
        timezone: 'Asia/Kolkata',
        badge: { verified_at: null, checks: ['Identity'] },
        open_now: false,
        hours: WEEK,
        closures: [],
        services: [{ ...SERVICE, id: 's-2', service_mode: 'home_visit' }],
        clinics: [],
      },
    ]);
    await renderRouter(routes, { initialUrl: '/discover/vet/v-1' });

    expect(await screen.findByTestId('visits-you')).toHaveTextContent(/Outside their travel area/);
    expect(api.calls.find((c) => c.path === '/discover/vets/v-1')?.query.get('lat')).toBe(
      '13.0067',
    );
  });
});
