import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderRouter } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';

import { createQueryClient } from '@/api';
import { resetSessionForTests, useSession } from '@/features/auth/session';
import { RootNavigator } from '@/navigation/RootNavigator';

import AuthLayout from '../app/(auth)/_layout';
import SignInScreen from '../app/(auth)/sign-in';
import VerifyScreen from '../app/(auth)/verify';
import BookingsScreen from '../app/(tabs)/bookings';
import CommunityScreen from '../app/(tabs)/community';
import DiscoverScreen from '../app/(tabs)/discover';
import HomeScreen from '../app/(tabs)/index';
import TabsLayout from '../app/(tabs)/_layout';
import PetsScreen from '../app/(tabs)/pets';
import OnboardingScreen from '../app/onboarding';
import ProfileScreen from '../app/profile';

import { createFakeApi, tokens, USER, type FakeApi } from './helpers/fakeApi';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;

function RootWithProviders() {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <RootNavigator />
    </QueryClientProvider>
  );
}

const routes = {
  _layout: RootWithProviders,
  '(auth)/_layout': AuthLayout,
  '(auth)/sign-in': SignInScreen,
  '(auth)/verify': VerifyScreen,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeScreen,
  '(tabs)/discover': DiscoverScreen,
  '(tabs)/bookings': BookingsScreen,
  '(tabs)/community': CommunityScreen,
  '(tabs)/pets': PetsScreen,
  onboarding: OnboardingScreen,
  profile: ProfileScreen,
};

let api: FakeApi;

beforeEach(() => {
  store.clear();
  resetSessionForTests();
  useSession.setState({ status: 'signedOut' });
  api = createFakeApi();
  globalThis.fetch = api.fetch;
});

describe('sign-in flow', () => {
  it('signed-out users only see sign-in, even when deep-linking into the app', async () => {
    await renderRouter(routes, { initialUrl: '/bookings' });
    expect(await screen.findByTestId('sign-in-screen')).toBeOnTheScreen();
    expect(screen.queryByTestId('bookings-screen')).toBeNull();
  });

  it('validates the mobile number before calling the API', async () => {
    await renderRouter(routes, { initialUrl: '/sign-in' });

    await fireEvent.changeText(await screen.findByTestId('destination-input'), '12345');
    await fireEvent.press(screen.getByTestId('send-code'));

    expect(
      await screen.findByText('Enter a valid 10-digit Indian mobile number.'),
    ).toBeOnTheScreen();
    expect(api.calls).toHaveLength(0);
  });

  it('phone sign-up: code → name → home, then sign out', async () => {
    api.on('POST', '/auth/otp/request', () => [
      202,
      { destination_masked: '+91******3210', expires_in_seconds: 600, resend_after_seconds: 60 },
    ]);
    api.on('POST', '/auth/otp/verify', (body) =>
      (body as { code: string }).code === '123456'
        ? [200, { ...tokens(1), user: USER, is_new_user: true }]
        : [
            400,
            {
              error: {
                code: 'invalid_code',
                message: 'That code is incorrect or has expired.',
                request_id: 'v',
              },
            },
          ],
    );
    api.on('PATCH', '/me', (body) => [
      200,
      { ...USER, display_name: (body as { display_name: string }).display_name },
    ]);
    api.on('POST', '/auth/logout', () => [204, undefined]);

    await renderRouter(routes, { initialUrl: '/sign-in' });

    await fireEvent.changeText(await screen.findByTestId('destination-input'), '98765 43210');
    await fireEvent.press(screen.getByTestId('send-code'));

    expect(await screen.findByTestId('verify-screen')).toBeOnTheScreen();
    expect(api.calls[0]?.body).toEqual({ channel: 'phone', destination: '+919876543210' });
    expect(screen.getByText('+91******3210')).toBeOnTheScreen();

    // Wrong code shows the server's message and clears the input.
    await fireEvent.changeText(screen.getByTestId('code-input'), '000000');
    expect(await screen.findByText('That code is incorrect or has expired.')).toBeOnTheScreen();

    // Correct code auto-submits at 6 digits; the guard moves a new user to onboarding.
    await fireEvent.changeText(screen.getByTestId('code-input'), '123456');
    expect(await screen.findByTestId('onboarding-screen')).toBeOnTheScreen();
    expect(store.get('petfinity.refresh_token')).toBe(tokens(1).refresh_token);

    await fireEvent.changeText(screen.getByTestId('display-name-input'), '  Priya  Nair ');
    await fireEvent.press(screen.getByTestId('save-name'));

    expect(await screen.findByTestId('home-screen')).toBeOnTheScreen();
    expect(screen.getByText('Hi, Priya')).toBeOnTheScreen();
    const patch = api.calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toEqual({ display_name: 'Priya Nair' });
    expect(patch?.headers.Authorization).toBe('Bearer access-1');

    // Sign out returns to sign-in and forgets the stored token.
    await fireEvent.press(screen.getByRole('button', { name: 'Profile and settings' }));
    await fireEvent.press(await screen.findByTestId('sign-out'));
    expect(await screen.findByTestId('sign-in-screen')).toBeOnTheScreen();
    await waitFor(() => expect(store.has('petfinity.refresh_token')).toBe(false));
  });

  it('shows rate-limit guidance from the server', async () => {
    api.on('POST', '/auth/otp/request', () => [
      429,
      {
        error: {
          code: 'rate_limited',
          message: 'Too many',
          details: { retry_after_seconds: 42 },
          request_id: 'r',
        },
      },
    ]);
    await renderRouter(routes, { initialUrl: '/sign-in' });

    await fireEvent.press(screen.getByRole('tab', { name: 'Email' }));
    await fireEvent.changeText(screen.getByTestId('destination-input'), 'priya@example.com');
    await fireEvent.press(screen.getByTestId('send-code'));

    expect(
      await screen.findByText('Please wait 42 seconds before requesting another code.'),
    ).toBeOnTheScreen();
    expect(api.calls[0]?.body).toEqual({ channel: 'email', destination: 'priya@example.com' });
  });
});
