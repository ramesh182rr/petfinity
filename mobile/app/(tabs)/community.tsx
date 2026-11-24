import { EmptyState } from '@/components/states/StateViews';
import { Screen, Text } from '@/components/ui';

export default function CommunityScreen() {
  return (
    <Screen testID="community-screen">
      <Text variant="title">Community</Text>
      <EmptyState
        icon="people-outline"
        tone="coral"
        title="Your local pet community"
        message="Share moments, ask questions and meet pet parents nearby, in a friendly, moderated space."
      />
    </Screen>
  );
}
