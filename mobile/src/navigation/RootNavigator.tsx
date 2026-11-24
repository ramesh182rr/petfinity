import { Stack } from 'expo-router';

import { needsOnboarding, useSession } from '@/features/auth/session';
import { colors, fonts } from '@/theme';

/**
 * Route access by session state (Expo Router protected routes):
 * - signed out            -> (auth): sign-in, verify
 * - signed in, no name    -> onboarding
 * - signed in, onboarded  -> (tabs), profile
 * When a guard flips, Expo Router removes the now-protected history and redirects.
 * Client-side only: the API enforces authorisation independently (decision 0006).
 */
export function RootNavigator() {
  const status = useSession((state) => state.status);
  const user = useSession((state) => state.user);
  const signedIn = status === 'signedIn';
  const onboarded = signedIn && !needsOnboarding(user);
  // Where a blocked route sends the user (redirectTo is SDK 58+).
  const home = !signedIn ? '/sign-in' : onboarded ? '/' : '/onboarding';

  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.primary,
        headerTitleStyle: { fontFamily: fonts.displaySemiBold, color: colors.text },
      }}
    >
      <Stack.Protected guard={onboarded} redirectTo={home}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !onboarded} redirectTo={home}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo={home}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
    </Stack>
  );
}
