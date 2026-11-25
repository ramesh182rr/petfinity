import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { createQueryClient } from '@/api';
import { completeSignIn, resetSessionForTests } from '@/features/auth/session';
import { RootNavigator } from '@/navigation/RootNavigator';

import HoursScreen from '../app/provider/manage/[ownerType]/[id]/hours';
import ManageScreen from '../app/provider/manage/[ownerType]/[id]/index';
import ServiceScreen from '../app/provider/manage/[ownerType]/[id]/service';

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
  'provider/manage/[ownerType]/[id]/index': ManageScreen,
  'provider/manage/[ownerType]/[id]/service': ServiceScreen,
  'provider/manage/[ownerType]/[id]/hours': HoursScreen,
};

const CLINIC = {
  id: 'c-1',
  name: 'Paws & Care Clinic',
  description: null,
  phone: '+914423456789',
  email: null,
  address_line1: '12, Lake View Road',
  address_line2: null,
  locality: 'Adyar',
  city: 'Chennai',
  state: 'Tamil Nadu',
  postal_code: '600020',
  latitude: null,
  longitude: null,
  timezone: 'Asia/Kolkata',
  emergency_services: false,
  verification_status: 'draft',
  verified_at: null,
  status: 'active',
  my_roles: ['operator'],
  created_at: 'x',
  updated_at: 'x',
};
const SERVICE = {
  id: 's-1',
  category: 'vaccination',
  title: 'Vaccination',
  description: null,
  price_minor: 60000,
  currency: 'INR',
  duration_minutes: 20,
  service_mode: 'in_clinic',
  confirmation_mode: 'instant',
  species: ['cat', 'dog'],
  active: true,
  created_at: 'x',
  updated_at: 'x',
};
const BASE = '/manage/clinic/c-1';

let api: FakeApi;
let services: (typeof SERVICE)[];
let rules: { weekday: number; start_time: string; end_time: string; capacity: number }[];

beforeEach(async () => {
  resetSessionForTests();
  api = createFakeApi();
  globalThis.fetch = api.fetch;
  services = [SERVICE];
  rules = [
    { weekday: 0, start_time: '09:00:00', end_time: '13:00:00', capacity: 1 },
    { weekday: 0, start_time: '15:00:00', end_time: '18:00:00', capacity: 1 },
  ];
  api.on('GET', '/clinics/c-1', () => [200, CLINIC]);
  api.on('GET', `${BASE}/services`, () => [200, services]);
  api.on('GET', `${BASE}/availability`, () => [200, { timezone: 'Asia/Kolkata', rules }]);
  api.on('GET', `${BASE}/exceptions`, () => [200, []]);
  api.on('GET', `${BASE}/slots`, () => [
    200,
    {
      date: '2026-12-07',
      timezone: 'Asia/Kolkata',
      service_id: 's-1',
      slots: [
        { start: '2026-12-07T03:30:00Z', end: 'x', local_start: '09:00', capacity: 1 },
        { start: '2026-12-07T03:50:00Z', end: 'x', local_start: '09:20', capacity: 1 },
      ],
    },
  ]);
  await completeSignIn({
    ...tokens(1),
    user: { ...USER, display_name: 'Priya' },
    is_new_user: false,
  });
});

describe('provider workspace', () => {
  it('summarises services, hours and slot preview', async () => {
    await renderRouter(routes, { initialUrl: `/provider/manage/clinic/c-1` });

    expect(await screen.findByTestId('service-s-1')).toBeOnTheScreen();
    expect(screen.getByText('₹600')).toBeOnTheScreen();
    expect(screen.getByText('Instant')).toBeOnTheScreen();
    expect(await screen.findByText('9:00 am – 1:00 pm,  3:00 pm – 6:00 pm')).toBeOnTheScreen();
    expect(screen.getAllByText('Closed').length).toBe(6);
    expect(await screen.findByText('9:20 am')).toBeOnTheScreen();
  });

  it('adds a service with the right payload and defaults', async () => {
    api.on('POST', `${BASE}/services`, (body) => {
      const created = { ...SERVICE, id: 's-2', ...(body as object) };
      services = [...services, created];
      return [201, created];
    });
    await renderRouter(routes, { initialUrl: `/provider/manage/clinic/c-1/service` });

    await fireEvent.press(await screen.findByText('Dental'));
    expect(screen.getByTestId('service-title').props.value).toBe('Dental');
    await fireEvent.changeText(screen.getByTestId('service-price'), '1,499.50');
    await fireEvent.press(screen.getByText('45 min'));
    await fireEvent.press(screen.getByTestId('service-save'));

    await waitFor(() => expect(api.calls.some((c) => c.method === 'POST')).toBe(true));
    expect(api.calls.find((c) => c.method === 'POST')?.body).toMatchObject({
      category: 'dental',
      title: 'Dental',
      price_minor: 149950,
      duration_minutes: 45,
      service_mode: 'in_clinic',
      confirmation_mode: 'instant',
      species: ['dog', 'cat'],
    });
  });

  it('rejects an invalid price before calling the API', async () => {
    await renderRouter(routes, { initialUrl: `/provider/manage/clinic/c-1/service` });
    await fireEvent.changeText(await screen.findByTestId('service-price'), 'free');
    await fireEvent.press(screen.getByTestId('service-save'));
    expect(await screen.findByText('Enter a price like 500 or 499.50.')).toBeOnTheScreen();
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('saves weekly hours as rules', async () => {
    api.on('PUT', `${BASE}/availability`, (body) => [
      200,
      { timezone: 'Asia/Kolkata', rules: (body as { rules: unknown[] }).rules },
    ]);
    await renderRouter(routes, { initialUrl: `/provider/manage/clinic/c-1/hours` });

    await fireEvent(await screen.findByLabelText('Saturday open'), 'valueChange', true);
    await fireEvent.press(screen.getByText('Copy Monday to Tue–Fri'));
    await fireEvent.press(screen.getByTestId('hours-save'));

    await waitFor(() => expect(api.calls.some((c) => c.method === 'PUT')).toBe(true));
    const saved = (
      api.calls.find((c) => c.method === 'PUT')?.body as { rules: { weekday: number }[] }
    ).rules;
    expect(saved.filter((r) => r.weekday <= 4)).toHaveLength(10); // Mon–Fri × 2 sessions
    expect(saved.filter((r) => r.weekday === 5)).toEqual([
      { weekday: 5, start_time: '09:00', end_time: '13:00', capacity: 1 },
    ]);
  });
});
