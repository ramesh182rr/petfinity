import { router } from 'expo-router';

import { EmptyState } from '@/components/states/StateViews';
import { Screen } from '@/components/ui';

export default function NotFoundScreen() {
  return (
    <Screen edges={[]}>
      <EmptyState
        icon="help-buoy-outline"
        tone="coral"
        title="This page wandered off"
        message="We couldn't find what you were looking for."
        action={{ label: 'Go home', onPress: () => router.replace('/') }}
      />
    </Screen>
  );
}
