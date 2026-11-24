import { EmptyState } from '@/components/states/StateViews';
import { Screen, Text } from '@/components/ui';

export default function DiscoverScreen() {
  return (
    <Screen testID="discover-screen">
      <Text variant="title">Discover</Text>
      <EmptyState
        icon="search-outline"
        tone="lavender"
        title="Trusted care near you"
        message="We're onboarding verified vets, clinics and caretakers in Tamil Nadu, Kerala and Bengaluru. You'll be able to search, compare and book them here."
      />
    </Screen>
  );
}
