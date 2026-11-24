import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/states/StateViews';
import { Button, Card, IconBadge, Screen, Text, type IconBadgeTone } from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { colors, spacing, touchTarget } from '@/theme';

type Shortcut = {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tone: IconBadgeTone;
  href: '/discover' | '/community' | '/bookings' | '/pets';
};

const SHORTCUTS: Shortcut[] = [
  { label: 'Vet care', icon: 'medkit-outline', tone: 'lavender', href: '/discover' },
  { label: 'Caretakers', icon: 'home-outline', tone: 'peach', href: '/discover' },
  { label: 'Community', icon: 'people-outline', tone: 'sage', href: '/community' },
  { label: 'My pets', icon: 'paw-outline', tone: 'coral', href: '/pets' },
];

export default function HomeScreen() {
  const firstName = useSession((state) => state.user?.display_name?.split(' ')[0]);
  return (
    <Screen testID="home-screen">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="title">{firstName ? `Hi, ${firstName}` : 'Welcome to Petfinity'}</Text>
          <Text variant="body" color="textMuted">
            Every paw. Every need. Every connection.
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Profile and settings"
          hitSlop={8}
          style={styles.avatar}
        >
          <Ionicons name="person-circle-outline" size={32} color={colors.primary} />
        </Pressable>
      </View>

      <Card tone="primary" style={styles.hero}>
        <Text variant="heading" color="textOnPrimary">
          Care for every paw, close to home
        </Text>
        <Text variant="body" color="textOnPrimary">
          Find trusted vets and caretakers near you, and keep your pet&apos;s care in one place.
        </Text>
        <View style={styles.heroActions}>
          <Button
            label="Book a vet"
            icon="medkit"
            variant="inverse"
            onPress={() => router.push('/discover')}
          />
          <Button
            label="Find a caretaker"
            variant="outlineInverse"
            onPress={() => router.push('/discover')}
          />
        </View>
      </Card>

      <View style={styles.section}>
        <Text variant="subheading">Explore</Text>
        <View style={styles.shortcuts}>
          {SHORTCUTS.map((item) => (
            <Pressable
              key={item.label}
              onPress={() => router.push(item.href)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              style={styles.shortcut}
            >
              <IconBadge name={item.icon} tone={item.tone} />
              <Text variant="label" align="center">
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="subheading">Upcoming</Text>
        <Card>
          <EmptyState
            icon="calendar-outline"
            tone="sage"
            title="No upcoming bookings"
            message="When you book a vet appointment or a caretaker, it will show up here."
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  avatar: {
    width: touchTarget,
    height: touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { gap: spacing.md, padding: spacing.xl },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  section: { gap: spacing.md },
  shortcuts: { flexDirection: 'row', justifyContent: 'space-between' },
  shortcut: { alignItems: 'center', gap: spacing.sm, flex: 1, minHeight: touchTarget },
});
