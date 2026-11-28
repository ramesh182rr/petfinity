import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { createQueryClient } from '@/api';
import { completeSignIn, resetSessionForTests } from '@/features/auth/session';
import { initialDrafts, toCareServices } from '@/features/care/drafts';
import { RootNavigator } from '@/navigation/RootNavigator';

import CareWorkspace from '../app/provider/care/[id]/index';
import CareServices from '../app/provider/care/[id]/services';

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
  'provider/care/[id]/index': CareWorkspace,
  'provider/care/[id]/services': CareServices,
};

const PROFILE = {
  id: 'ct-1',
  provider_type: 'caretaker',
  display_name: 'Priya Nair',
  bio: null,
  years_experience: 5,
  languages: [],
  city: 'Chennai',
  registration_number: null,
  registration_council: null,
  qualifications: null,
  area_key: 'chennai',
  latitude: null,
  longitude: null,
  service_radius_km: 10,
  home_type: 'independent_house',
  outdoor_space: true,
  pets_at_home: null,
  max_concurrent: 2,
  verification_status: 'draft',
  verified_at: null,
  status: 'active',
  created_at: 'x',
  updated_at: 'x',
};

let api: FakeApi;

beforeEach(async () => {
  resetSessionForTests();
  api = createFakeApi();
  globalThis.fetch = api.fetch;
  api.on('GET', '/me/provider-profiles/ct-1', () => [200, PROFILE]);
  api.on('GET', '/manage/provider_profile/ct-1/exceptions', () => [200, []]);
  await completeSignIn({
    ...tokens(1),
    user: { ...USER, display_name: 'Priya' },
    is_new_user: false,
  });
});

describe('caretaker workspace', () => {
  it('shows the readiness checklist and saves services', async () => {
    let workspace = {
      services: [] as unknown[],
      missing: ['services', 'verification'],
      receiving_requests: false,
    };
    api.on('GET', '/manage/provider_profile/ct-1/care', () => [200, workspace]);
    api.on('PUT', '/manage/provider_profile/ct-1/care/services', (body) => {
      const services = (body as { services: { care_type: string; rate_minor: number }[] }).services;
      workspace = {
        services: services.map((s, i) => ({
          id: `s-${i}`,
          ...s,
          rate_unit: s.care_type === 'home_visit' ? 'visit' : 'night',
          notes: null,
          active: true,
          updated_at: 'x',
        })),
        missing: ['verification'],
        receiving_requests: false,
      };
      return [200, workspace];
    });

    await renderRouter(routes, { initialUrl: '/provider/care/ct-1' });
    expect(await screen.findByTestId('care-readiness')).toHaveTextContent(/2 steps left/);
    await fireEvent.press(screen.getByTestId('ready-services'));
    expect(await screen.findByTestId('care-services')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('care-toggle-home_visit'), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('care-save'));
    expect(await screen.findByText('Enter a starting rate in rupees.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('care-rate-home_visit'), '300');
    await fireEvent.press(screen.getByTestId('care-save'));
    await waitFor(() =>
      expect(api.calls.find((c) => c.method === 'PUT')?.body).toEqual({
        services: [
          {
            care_type: 'home_visit',
            rate_minor: 30000,
            species: ['dog', 'cat'],
            max_pets: 2,
            active: true,
          },
        ],
      }),
    );
  });

  it('says when the caretaker is live', async () => {
    api.on('GET', '/manage/provider_profile/ct-1/care', () => [
      200,
      { services: [], missing: [], receiving_requests: true },
    ]);
    await renderRouter(routes, { initialUrl: '/provider/care/ct-1' });
    expect(await screen.findByTestId('care-live')).toBeOnTheScreen();
  });
});

describe('care drafts', () => {
  it('validates each offered type', () => {
    const drafts = initialDrafts([]);
    expect(toCareServices(drafts)).toEqual({ ok: true, services: [] });
    drafts.boarding = { on: true, rate: '900', species: [], maxPets: 3 };
    expect(toCareServices(drafts)).toEqual({
      ok: false,
      errors: { boarding: 'Choose at least one kind of pet.' },
    });
    drafts.boarding.species = ['dog'];
    const ok = toCareServices(drafts);
    expect(ok.ok && ok.services[0]).toMatchObject({
      care_type: 'boarding',
      rate_minor: 90000,
      max_pets: 3,
    });
  });
});
