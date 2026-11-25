import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { createQueryClient } from '@/api';
import { completeSignIn, resetSessionForTests } from '@/features/auth/session';
import { RootNavigator } from '@/navigation/RootNavigator';

import ProviderHub from '../app/provider/index';
import NewProviderProfile from '../app/provider/profile/new';
import VerificationScreen from '../app/provider/verify/[subjectType]/[id]';

import { createFakeApi, tokens, USER, type FakeApi } from './helpers/fakeApi';

jest.mock('@/features/providers/documentPicking', () => ({
  ...jest.requireActual('@/features/providers/documentPicking'),
  pickDocument: jest.fn(async () => ({
    uri: 'file:///id.pdf',
    name: 'id.pdf',
    contentType: 'application/pdf',
    blob: { size: 2048 },
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
  'provider/index': ProviderHub,
  'provider/profile/new': NewProviderProfile,
  'provider/verify/[subjectType]/[id]': VerificationScreen,
};

const PROFILE = {
  id: 'pp-1',
  provider_type: 'veterinarian',
  display_name: 'Dr. Priya Nair',
  bio: null,
  years_experience: null,
  languages: [],
  city: null,
  registration_number: null,
  registration_council: null,
  qualifications: null,
  verification_status: 'draft',
  verified_at: null,
  status: 'active',
  created_at: '2026-11-25T00:00:00Z',
  updated_at: '2026-11-25T00:00:00Z',
};

function overview(over: Record<string, unknown> = {}) {
  return {
    verification_status: 'draft',
    can_edit_documents: true,
    required_documents: ['identity', 'vet_registration'],
    missing_documents: ['identity', 'vet_registration'],
    missing_fields: [],
    documents: [],
    latest_submission: null,
    ...over,
  };
}

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

describe('become a provider', () => {
  it('creates a vet profile, uploads a document and submits for review', async () => {
    let profiles: (typeof PROFILE)[] = [];
    let state = overview({ missing_fields: ['registration_number', 'registration_council'] });
    api.on('GET', '/me/provider-profiles', () => [200, profiles]);
    api.on('GET', '/me/clinics', () => [200, []]);
    api.on('GET', '/me', () => [
      200,
      { ...USER, display_name: 'Priya', capabilities: ['pet_parent', 'veterinarian'] },
    ]);
    api.on('POST', '/me/provider-profiles', (body) => {
      profiles = [{ ...PROFILE, ...(body as object) }];
      return [201, profiles[0]];
    });
    api.on('GET', '/me/provider-profiles/pp-1', () => [200, profiles[0]]);
    api.on('GET', '/verification/provider_profile/pp-1', () => [200, state]);
    api.on('POST', '/verification/provider_profile/pp-1/documents/upload-url', () => [
      201,
      {
        media_id: 'm-1',
        upload: {
          url: '/api/v1/dev-storage/v/x.pdf?sig=1',
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
        },
        expires_at: 'x',
      },
    ]);
    api.on('PUT', '/dev-storage/v/x.pdf', () => [204, undefined]);
    api.on('POST', '/verification/provider_profile/pp-1/documents', (body) => {
      state = overview({
        missing_documents: ['vet_registration'],
        documents: [
          {
            id: 'd-1',
            doc_type: (body as { doc_type: string }).doc_type,
            content_type: 'application/pdf',
            size_bytes: 2048,
            uploaded_at: 'x',
            submitted: false,
          },
        ],
      });
      return [201, state.documents[0]];
    });

    await renderRouter(routes, { initialUrl: '/provider' });

    await fireEvent.press(await screen.findByTestId('start-veterinarian'));
    await fireEvent.changeText(await screen.findByTestId('provider-displayName'), 'Dr. Priya Nair');
    await fireEvent.press(screen.getByText('Tamil'));
    await fireEvent.press(screen.getByTestId('provider-submit'));

    expect(
      await screen.findByTestId('verification-screen', {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    expect(
      api.calls.find((c) => c.method === 'POST' && c.path === '/me/provider-profiles')?.body,
    ).toMatchObject({
      provider_type: 'veterinarian',
      display_name: 'Dr. Priya Nair',
      languages: ['Tamil'],
    });
    expect(screen.getByTestId('missing-fields')).toBeOnTheScreen();
    expect(screen.getByTestId('submit-review')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('upload-identity'));
    await waitFor(() =>
      expect(api.calls.some((c) => c.method === 'POST' && c.path.endsWith('/documents'))).toBe(
        true,
      ),
    );
    expect(api.calls.find((c) => c.path.endsWith('/upload-url'))?.body).toEqual({
      doc_type: 'identity',
      content_type: 'application/pdf',
      size_bytes: 2048,
    });
    expect(await screen.findByText('Uploaded', {}, { timeout: 5000 })).toBeOnTheScreen();
  }, 20_000);

  it('shows the review message when more information is needed', async () => {
    api.on('GET', '/me/provider-profiles/pp-1', () => [
      200,
      { ...PROFILE, verification_status: 'needs_info' },
    ]);
    api.on('GET', '/verification/provider_profile/pp-1', () => [
      200,
      overview({
        verification_status: 'needs_info',
        missing_documents: [],
        latest_submission: {
          id: 's',
          status: 'needs_info',
          submitted_at: 'x',
          reviewed_at: 'y',
          decision_reason: 'The certificate is blurry.',
        },
      }),
    ]);

    await renderRouter(routes, { initialUrl: '/provider/verify/provider_profile/pp-1' });

    expect(await screen.findByTestId('review-message')).toHaveTextContent(
      'The certificate is blurry.',
    );
    expect(screen.getByTestId('verification-status')).toBeOnTheScreen();
    expect(screen.getByTestId('submit-review')).not.toBeDisabled();
  });

  it('locks documents while under review', async () => {
    api.on('GET', '/me/provider-profiles/pp-1', () => [
      200,
      { ...PROFILE, verification_status: 'submitted' },
    ]);
    api.on('GET', '/verification/provider_profile/pp-1', () => [
      200,
      overview({
        verification_status: 'submitted',
        can_edit_documents: false,
        missing_documents: [],
      }),
    ]);

    await renderRouter(routes, { initialUrl: '/provider/verify/provider_profile/pp-1' });

    expect(await screen.findByText('Waiting for review')).toBeOnTheScreen();
    expect(screen.queryByTestId('submit-review')).toBeNull();
    expect(screen.queryByTestId('upload-identity')).toBeNull();
  });
});
