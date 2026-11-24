import { create } from 'zustand';

import { apiClient, isApiError } from '@/api';

import * as authApi from './api';
import { clearRefreshToken, loadRefreshToken, saveRefreshToken } from './tokenStorage';
import type { Me, SignInResponse, TokenResponse } from './types';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

type SessionState = {
  status: SessionStatus;
  user: Me | null;
  accessToken: string | null;
};

const initialState: SessionState = { status: 'loading', user: null, accessToken: null };

export const useSession = create<SessionState>()(() => initialState);

function setTokens(tokens: TokenResponse): Promise<void> {
  useSession.setState({ accessToken: tokens.access_token });
  return saveRefreshToken(tokens.refresh_token);
}

async function clearLocalSession(): Promise<void> {
  useSession.setState({ status: 'signedOut', user: null, accessToken: null });
  await clearRefreshToken();
}

// --- refresh (single-flight) ------------------------------------------------------
// Parallel refreshes would trip the server's reuse detection (decision 0007),
// so every caller shares one in-flight refresh.
let refreshInFlight: Promise<boolean> | null = null;

export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    try {
      const stored = await loadRefreshToken();
      if (!stored) {
        await clearLocalSession();
        return false;
      }
      const tokens = await authApi.refreshTokens(stored);
      await setTokens(tokens);
      return true;
    } catch (error) {
      // Only a definitive rejection ends the session; a network blip keeps it.
      if (isApiError(error) && error.status !== null && error.status < 500) {
        await clearLocalSession();
      }
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

apiClient.setAuthHandlers({
  getAccessToken: () => useSession.getState().accessToken,
  refresh: refreshSession,
});

// --- lifecycle actions -------------------------------------------------------------

/** Restore a session at app start. Leaves status 'signedIn' or 'signedOut'. */
export async function bootstrapSession(): Promise<void> {
  const stored = await loadRefreshToken();
  if (!stored) {
    useSession.setState({ status: 'signedOut', user: null, accessToken: null });
    return;
  }
  try {
    const refreshed = await refreshSession();
    if (!refreshed) {
      if (useSession.getState().status === 'loading') {
        // Network issue at launch: stay signed out for now; the token is kept.
        useSession.setState({ status: 'signedOut' });
      }
      return;
    }
    const user = await authApi.fetchMe();
    useSession.setState({ status: 'signedIn', user });
  } catch {
    useSession.setState({ status: 'signedOut', user: null, accessToken: null });
  }
}

export async function completeSignIn(response: SignInResponse): Promise<void> {
  await setTokens(response);
  useSession.setState({ status: 'signedIn', user: response.user });
}

export function setUser(user: Me): void {
  useSession.setState({ user });
}

export async function signOut(): Promise<void> {
  try {
    await authApi.logout();
  } catch {
    // Server unreachable or session already gone: still sign out locally.
  }
  await clearLocalSession();
}

/** Test helper. */
export function resetSessionForTests(): void {
  refreshInFlight = null;
  useSession.setState(initialState);
}

export function needsOnboarding(user: Me | null): boolean {
  return !user?.display_name;
}
