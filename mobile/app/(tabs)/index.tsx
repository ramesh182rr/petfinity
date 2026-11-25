import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/states/StateViews';
import {
  ActionCard,
  Card,
  HeroHeader,
  InitialsAvatar,
  SectionHeader,
  StatusBarScrim,
  useHeroScroll,
} from '@/components/ui';
import { useSession } from '@/features/auth/session';
import { PetSwitcher } from '@/features/pets/PetSwitcher';
import { timeOfDayGreeting } from '@/lib/greeting';
import { colors, spacing } from '@/theme';

export default function HomeScreen() {
  const user = useSession((state) => state.user);
  const firstName = user?.display_name?.split(' ')[0];
  const scroll = useHeroScroll();

  return (
    <View style={styles.screen}>
      <ScrollView
        onScroll={scroll.onScroll}
        scrollEventThrottle={scroll.scrollEventThrottle}
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="home-screen"
      >
        <HeroHeader
          edgeToEdge
          eyebrow={timeOfDayGreeting()}
          title={firstName ? `Hi, ${firstName}` : 'Welcome to Petfinity'}
          subtitle="Trusted care for every paw, close to home."
          accessory={
            <Pressable
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profile and settings"
              hitSlop={8}
            >
              <InitialsAvatar name={user?.display_name} />
            </Pressable>
          }
          style={styles.hero}
        />

        <View style={styles.actions}>
          <ActionCard
            icon="medkit"
            tone="lavender"
            gradient="lavender"
            title="Book a vet"
            subtitle="Clinic visits and home check-ups"
            onPress={() => router.push('/discover')}
            testID="action-book-vet"
          />
          <ActionCard
            icon="home"
            tone="peach"
            gradient="coral"
            title="Find a caretaker"
            subtitle="Sitting, day care and boarding"
            onPress={() => router.push('/discover')}
            testID="action-find-caretaker"
          />
        </View>

        <View style={styles.body}>
          <PetSwitcher />

          <View style={styles.section}>
            <SectionHeader title="Explore" />
            <View style={styles.grid}>
              <View style={styles.gridRow}>
                <ActionCard
                  icon="search"
                  tone="lavender"
                  gradient="lavender"
                  title="Discover"
                  subtitle="Vets and clinics near you"
                  onPress={() => router.push('/discover')}
                />
                <ActionCard
                  icon="people"
                  tone="sage"
                  gradient="sage"
                  title="Community"
                  subtitle="Local pet parents"
                  onPress={() => router.push('/community')}
                />
              </View>
              <View style={styles.gridRow}>
                <ActionCard
                  icon="paw"
                  tone="coral"
                  gradient="coral"
                  title="My pets"
                  subtitle="Profiles and care notes"
                  onPress={() => router.push('/pets')}
                />
                <ActionCard
                  icon="calendar"
                  tone="peach"
                  gradient="warm"
                  title="Bookings"
                  subtitle="Appointments and stays"
                  onPress={() => router.push('/bookings')}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <SectionHeader title="Upcoming" />
            <Card>
              <EmptyState
                compact
                icon="calendar-outline"
                tone="sage"
                title="No upcoming bookings"
                message="When you book a vet or a caretaker, it will show up here."
              />
            </Card>
          </View>
        </View>
      </ScrollView>
      <StatusBarScrim scrolled={scroll.scrolled} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  hero: { paddingBottom: spacing.xxxl + spacing.xl },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginTop: -(spacing.xxxl + spacing.sm),
  },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.xl },
  section: { gap: spacing.md },
  grid: { gap: spacing.md },
  gridRow: { flexDirection: 'row', gap: spacing.md },
});
