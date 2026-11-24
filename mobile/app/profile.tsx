import Constants from 'expo-constants';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/states/StateViews';
import { Screen, Text } from '@/components/ui';
import { ApiStatusPill } from '@/features/system/ApiStatusPill';
import { spacing } from '@/theme';

export default function ProfileScreen() {
  return (
    <Screen edges={[]} testID="profile-screen">
      <EmptyState
        icon="person-circle-outline"
        tone="lavender"
        title="Your Petfinity account"
        message="Sign in to manage your profile, pets, notifications and privacy settings, or to become a provider."
      />
      <View style={styles.footer}>
        {__DEV__ ? <ApiStatusPill /> : null}
        <Text variant="caption" color="textMuted" align="center">
          Petfinity {Constants.expoConfig?.version ?? ''}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.md, alignItems: 'center' },
});
