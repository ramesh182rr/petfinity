import * as SecureStore from 'expo-secure-store';

import { apiClient } from '@/api';
import {
  bootstrapSession,
  completeSignIn,
  refreshSession,
  resetSessionForTests,
  signOut,
  useSession,
} from '@/features/auth/session';

import { createFakeApi, tokens, USER, type FakeApi } from './helpers/fakeApi';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
let api: FakeApi;

beforeEach(() => {
  store.clear();
  resetSessionForTests();
  api = createFakeApi();
  globalThis.fetch = api.fetch;
});

describe('session lifecycle', () => {
  it('starts signed out when no refresh token is stored', async () => {
    await bootstrapSession();
    expect(useSession.getState().status).toBe('signedOut');
    expect(api.calls).toHaveLength(0);
  });

  it('restores a stored session by refreshing and loading the profile', async () => {
    store.set('petfinity.refresh_token', 'stored-refresh');
    api.on('POST', '/auth/refresh', () => [200, tokens(2)]);
    api.on('GET', '/me', () => [200, { ...USER, display_name: 'Priya' }]);

    await bootstrapSession();

    const state = useSession.getState();
    expect(state.status).toBe('signedIn');
    expect(state.user?.display_name).toBe('Priya');
    expect(state.accessToken).toBe('access-2');
    expect(store.get('petfinity.refresh_token')).toBe(tokens(2).refresh_token);
    expect(api.calls[1]?.headers.Authorization).toBe('Bearer access-2');
  });

  it('clears a stored token the server rejects', async () => {
    store.set('petfinity.refresh_token', 'revoked');
    api.on('POST', '/auth/refresh', () => [
      401,
      { error: { code: 'invalid_refresh_token', message: 'Session ended.', request_id: 'r' } },
    ]);

    await bootstrapSession();

    expect(useSession.getState().status).toBe('signedOut');
    expect(store.has('petfinity.refresh_token')).toBe(false);
  });

  it('keeps the stored token when the server is unreachable', async () => {
    store.set('petfinity.refresh_token', 'still-valid');
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await bootstrapSession();

    expect(useSession.getState().status).toBe('signedOut');
    expect(store.get('petfinity.refresh_token')).toBe('still-valid');
  });

  it('stores only the refresh token persistently on sign-in', async () => {
    await completeSignIn({ ...tokens(1), user: USER, is_new_user: true });

    expect(useSession.getState().status).toBe('signedIn');
    expect(store.get('petfinity.refresh_token')).toBe(tokens(1).refresh_token);
    expect([...store.values()]).not.toContain('access-1');
  });

  it('signs out locally even if the server call fails', async () => {
    await completeSignIn({ ...tokens(1), user: USER, is_new_user: false });
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('offline'));

    await signOut();

    expect(useSession.getState()).toMatchObject({
      status: 'signedOut',
      user: null,
      accessToken: null,
    });
    expect(store.has('petfinity.refresh_token')).toBe(false);
  });
});

describe('authenticated requests', () => {
  it('refreshes once on 401 and retries the original request', async () => {
    await completeSignIn({ ...tokens(1), user: USER, is_new_user: false });
    api.on('GET', '/me', (_body, headers) =>
      headers.Authorization === 'Bearer access-2'
        ? [200, USER]
        : [401, { error: { code: 'unauthorized', message: 'Expired', request_id: 'a' } }],
    );
    api.on('POST', '/auth/refresh', () => [200, tokens(2)]);

    await expect(apiClient.request('/me')).resolves.toMatchObject({ id: USER.id });
    expect(api.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'GET /me',
      'POST /auth/refresh',
      'GET /me',
    ]);
  });

  it('shares a single refresh between concurrent 401s', async () => {
    await completeSignIn({ ...tokens(1), user: USER, is_new_user: false });
    api.on('GET', '/me', (_b, headers) =>
      headers.Authorization === 'Bearer access-2'
        ? [200, USER]
        : [401, { error: { code: 'unauthorized', message: 'Expired', request_id: 'a' } }],
    );
    api.on('POST', '/auth/refresh', () => [200, tokens(2)]);

    await Promise.all([
      apiClient.request('/me'),
      apiClient.request('/me'),
      apiClient.request('/me'),
    ]);

    expect(api.calls.filter((c) => c.path === '/auth/refresh')).toHaveLength(1);
  });

  it('never sends tokens to public endpoints', async () => {
    await completeSignIn({ ...tokens(1), user: USER, is_new_user: false });
    api.on('POST', '/auth/otp/request', () => [202, {}]);

    await apiClient.request('/auth/otp/request', { method: 'POST', body: {}, auth: false });

    expect(api.calls[0]?.headers.Authorization).toBeUndefined();
  });

  it('signs out when refresh is rejected', async () => {
    await completeSignIn({ ...tokens(1), user: USER, is_new_user: false });
    api.on('GET', '/me', () => [
      401,
      { error: { code: 'unauthorized', message: 'x', request_id: 'a' } },
    ]);
    api.on('POST', '/auth/refresh', () => [
      401,
      { error: { code: 'invalid_refresh_token', message: 'x', request_id: 'b' } },
    ]);

    await expect(apiClient.request('/me')).rejects.toMatchObject({ status: 401 });
    expect(useSession.getState().status).toBe('signedOut');
    expect(await refreshSession()).toBe(false);
  });
});
