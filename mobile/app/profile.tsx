import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  Button,
  Card,
  HeroScreen,
  InitialsAvatar,
  ListRow,
  SectionHeader,
  StatusPill,
  Text,
} from '@/components/ui';
import { signOut, useSession } from '@/features/auth/session';
import { ApiStatusPill } from '@/features/system/ApiStatusPill';
import { transparentHeader } from '@/navigation/headerOptions';
import { spacing } from '@/theme';

const ROLE_LABELS: Record<string, string> = {
  veterinarian: 'Veterinarian',
  caretaker: 'Caretaker',
  clinic_operator: 'Clinic operator',
  moderator: 'Moderator',
  admin: 'Admin',
};

export default function ProfileScreen() {
  const user = useSession((state) => state.user);
  const [signingOut, setSigningOut] = useState(false);
  const roles = (user?.capabilities ?? []).filter((c) => c !== 'pet_parent');
  const isProvider = roles.some(
    (r) => r === 'veterinarian' || r === 'caretaker' || r === 'clinic_operator',
  );

  return (
    <>
      <Stack.Screen options={transparentHeader} />
      <HeroScreen
        testID="profile-screen"
        underHeader
        eyebrow="Your account"
        title={user?.display_name ?? 'Pet parent'}
        subtitle={user?.email ?? user?.phone ?? undefined}
        accessory={<InitialsAvatar name={user?.display_name} size={56} />}
        heroContent={
          roles.length ? (
            <View style={styles.roles}>
              {roles.map((r) => (
                <StatusPill key={r} label={ROLE_LABELS[r] ?? r} tone="onDark" />
              ))}
            </View>
          ) : null
        }
        overlap
      >
        <Card style={styles.card}>
          <ListRow
            testID="become-provider"
            icon="briefcase"
            tone="lavender"
            title={isProvider ? 'Provider profiles' : 'Become a provider'}
            subtitle={
              isProvider ? 'Verification status and documents' : 'Vets, caretakers and clinics'
            }
            onPress={() => router.push('/provider')}
          />
          <ListRow
            icon="paw"
            tone="coral"
            title="My pets"
            subtitle="Profiles and care notes"
            onPress={() => router.push('/pets')}
          />
        </Card>

        <View style={styles.section}>
          <SectionHeader title="Settings" />
          <Card style={styles.card}>
            <ListRow
              icon="notifications"
              tone="peach"
              title="Notifications"
              subtitle="Booking updates and reminders"
              trailing={<StatusPill label="Soon" tone="neutral" />}
            />
            <ListRow
              icon="lock-closed"
              tone="sage"
              title="Privacy & data"
              subtitle="Export or delete your data"
              trailing={<StatusPill label="Soon" tone="neutral" />}
            />
            <ListRow
              icon="help-buoy"
              tone="lavender"
              title="Help & support"
              subtitle="Questions, safety and feedback"
              trailing={<StatusPill label="Soon" tone="neutral" />}
            />
          </Card>
        </View>

        <Button
          testID="sign-out"
          label="Sign out"
          icon="log-out-outline"
          variant="secondary"
          size="lg"
          fullWidth
          loading={signingOut}
          onPress={async () => {
            setSigningOut(true);
            await signOut();
          }}
        />

        <View style={styles.footer}>
          {__DEV__ ? <ApiStatusPill /> : null}
          <Text variant="caption" color="textMuted" align="center">
            Petfinity {Constants.expoConfig?.version ?? ''}
          </Text>
        </View>
      </HeroScreen>
    </>
  );
}

const styles = StyleSheet.create({
  roles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: { paddingVertical: spacing.sm },
  section: { gap: spacing.md },
  footer: { gap: spacing.md, alignItems: 'center' },
});
