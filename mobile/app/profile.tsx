import Constants from 'expo-constants';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Card, IconBadge, Screen, Text } from '@/components/ui';
import { signOut, useSession } from '@/features/auth/session';
import { ApiStatusPill } from '@/features/system/ApiStatusPill';
import { spacing } from '@/theme';

export default function ProfileScreen() {
  const user = useSession((state) => state.user);
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    setSigningOut(true);
    await signOut(); // the navigation guard returns to sign-in
  };

  return (
    <Screen edges={[]} testID="profile-screen">
      <Card>
        <View style={styles.identity}>
          <IconBadge name="person" tone="lavender" />
          <View style={styles.identityText}>
            <Text variant="heading">{user?.display_name ?? 'Pet parent'}</Text>
            {user?.email ? (
              <Text variant="body" color="textMuted">
                {user.email}
              </Text>
            ) : null}
            {user?.phone ? (
              <Text variant="body" color="textMuted">
                {user.phone}
              </Text>
            ) : null}
          </View>
        </View>
      </Card>

      <Text variant="body" color="textMuted">
        Pet profiles, notification settings, privacy controls and &quot;Become a provider&quot; will
        appear here.
      </Text>

      <Button
        testID="sign-out"
        label="Sign out"
        icon="log-out-outline"
        variant="secondary"
        fullWidth
        loading={signingOut}
        onPress={onSignOut}
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
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  identityText: { flex: 1, gap: spacing.xxs },
  footer: { gap: spacing.md, alignItems: 'center' },
});
