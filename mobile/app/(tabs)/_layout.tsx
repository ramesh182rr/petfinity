import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { colors, fonts } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function tabIcon(active: IconName, inactive: IconName) {
  // Colours come straight from design tokens (same values as the tab tint colours).
  function TabIcon({ focused }: { focused: boolean }) {
    return (
      <Ionicons
        name={focused ? active : inactive}
        size={24}
        color={focused ? colors.primary : colors.textMuted}
      />
    );
  }
  return TabIcon;
}

/** Five-tab navigation from doc 08: Home, Discover, Bookings, Community, My Pets. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fonts.bodySemiBold, fontSize: 12 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarIcon: tabIcon('search', 'search-outline') }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: 'Bookings', tabBarIcon: tabIcon('calendar', 'calendar-outline') }}
      />
      <Tabs.Screen
        name="community"
        options={{ title: 'Community', tabBarIcon: tabIcon('people', 'people-outline') }}
      />
      <Tabs.Screen
        name="pets"
        options={{ title: 'My Pets', tabBarIcon: tabIcon('paw', 'paw-outline') }}
      />
    </Tabs>
  );
}
