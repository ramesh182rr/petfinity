import { router } from 'expo-router';

import { EmptyState } from '@/components/states/StateViews';
import { Screen, Text } from '@/components/ui';

export default function BookingsScreen() {
  return (
    <Screen testID="bookings-screen">
      <Text variant="title">Bookings</Text>
      <EmptyState
        icon="calendar-outline"
        tone="sage"
        title="No bookings yet"
        message="Your vet appointments and caretaker bookings will appear here, with times, status and directions."
        action={{ label: 'Explore care', onPress: () => router.push('/discover') }}
      />
    </Screen>
  );
}
