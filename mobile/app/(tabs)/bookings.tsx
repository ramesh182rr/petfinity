import { router } from 'expo-router';

import { EmptyState } from '@/components/states/StateViews';
import { Card, HeroScreen } from '@/components/ui';

export default function BookingsScreen() {
  return (
    <HeroScreen
      testID="bookings-screen"
      eyebrow="Bookings"
      title="Your appointments"
      subtitle="Vet visits and caretaker stays, all in one place."
      gradient="dusk"
      overlap
    >
      <Card>
        <EmptyState
          icon="calendar-outline"
          tone="sage"
          title="No bookings yet"
          message="Your vet appointments and caretaker bookings will appear here, with times, status and directions."
          action={{ label: 'Explore care', onPress: () => router.push('/discover') }}
        />
      </Card>
    </HeroScreen>
  );
}
