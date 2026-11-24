import { Stack } from 'expo-router';

import { colors, fonts } from '@/theme';

export default function AuthLayout() {
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
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="verify" options={{ title: '' }} />
    </Stack>
  );
}
