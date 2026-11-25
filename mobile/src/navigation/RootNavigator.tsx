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
        <Stack.Screen name="pets/new" options={{ title: 'Add a pet' }} />
        <Stack.Screen name="pets/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="pets/[id]/edit" options={{ title: 'Edit pet' }} />
        <Stack.Screen name="provider/index" options={{ title: '' }} />
        <Stack.Screen name="provider/profile/new" options={{ title: 'Your provider profile' }} />
        <Stack.Screen name="provider/profile/[id]" options={{ title: 'Edit profile' }} />
        <Stack.Screen name="provider/clinic/new" options={{ title: 'Add your clinic' }} />
        <Stack.Screen name="provider/clinic/[id]" options={{ title: 'Edit clinic' }} />
        <Stack.Screen name="provider/verify/[subjectType]/[id]" options={{ title: '' }} />
        <Stack.Screen name="provider/manage/[ownerType]/[id]/index" options={{ title: '' }} />
        <Stack.Screen
          name="provider/manage/[ownerType]/[id]/service"
          options={{ title: 'Service' }}
        />
        <Stack.Screen
          name="provider/manage/[ownerType]/[id]/hours"
          options={{ title: 'Opening hours' }}
        />
        <Stack.Screen
          name="provider/manage/[ownerType]/[id]/day-off"
          options={{ title: 'Day off or special hours' }}
        />
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
