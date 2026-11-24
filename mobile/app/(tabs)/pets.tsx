import { EmptyState } from '@/components/states/StateViews';
import { Screen, Text } from '@/components/ui';

export default function PetsScreen() {
  return (
    <Screen testID="pets-screen">
      <Text variant="title">My Pets</Text>
      <EmptyState
        icon="paw-outline"
        tone="peach"
        title="Every pet, one place"
        message="Create a profile for each of your pets — dogs, cats and every other companion — with their care notes and health details."
      />
    </Screen>
  );
}
