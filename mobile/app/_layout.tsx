import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createQueryClient } from '@/api';
import { bootstrapSession, useSession } from '@/features/auth/session';
import { RootNavigator } from '@/navigation/RootNavigator';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden (e.g. fast refresh) — safe to ignore.
});

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const sessionLoading = useSession((state) => state.status === 'loading');
  const ready = (fontsLoaded || fontError !== null) && !sessionLoading;

  useEffect(() => {
    void bootstrapSession();
  }, []);

  useEffect(() => {
    if (ready) {
      // If fonts fail, continue with system fonts rather than blocking the app.
      SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready]);

  if (!ready) {
    return null; // splash screen stays visible
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
