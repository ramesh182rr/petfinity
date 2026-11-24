import { apiClient } from '@/api';

import type { Channel, Me, OtpRequestResponse, SignInResponse, TokenResponse } from './types';

export function requestOtp(channel: Channel, destination: string): Promise<OtpRequestResponse> {
  return apiClient.request('/auth/otp/request', {
    method: 'POST',
    body: { channel, destination },
    auth: false,
  });
}

export function verifyOtp(
  channel: Channel,
  destination: string,
  code: string,
): Promise<SignInResponse> {
  return apiClient.request('/auth/otp/verify', {
    method: 'POST',
    body: { channel, destination, code },
    auth: false,
  });
}

export function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return apiClient.request('/auth/refresh', {
    method: 'POST',
    body: { refresh_token: refreshToken },
    auth: false,
  });
}

export function fetchMe(): Promise<Me> {
  return apiClient.request('/me');
}

export function updateMe(displayName: string): Promise<Me> {
  return apiClient.request('/me', { method: 'PATCH', body: { display_name: displayName } });
}

export function logout(): Promise<void> {
  return apiClient.request('/auth/logout', { method: 'POST' });
}
