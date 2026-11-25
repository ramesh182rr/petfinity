import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { colors, elevation, radius, spacing } from '@/theme';

/**
 * Floating pill tab bar: a rounded white bar inset from the screen edges,
 * active tab highlighted with a plum pill behind its icon.
 * It sits in the layout flow (not absolute), so screens never hide content behind it.
 */
export function FloatingTabBar({ state, descriptors, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          if (!descriptor) return null;
          const { options } = descriptor;
          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          const color = focused ? colors.textOnPrimary : colors.textMuted;

          const onPress = () => {
            if (!focused) navigateToTab(route.key);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              testID={`tab-${route.name}`}
              style={styles.item}
            >
              <View style={[styles.iconPill, focused && styles.iconPillActive]}>
                {options.tabBarIcon?.({ focused, color, size: 22 })}
              </View>
              <Text
                variant="caption"
                numberOfLines={1}
                style={[styles.label, focused && styles.labelActive]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.xxl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    ...elevation.raised,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    minHeight: 52,
  },
  iconPill: {
    width: 48,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: { backgroundColor: colors.primary },
  label: { fontSize: 11, lineHeight: 14, color: colors.textMuted },
  labelActive: { color: colors.primary, fontFamily: 'Inter_600SemiBold' },
});
