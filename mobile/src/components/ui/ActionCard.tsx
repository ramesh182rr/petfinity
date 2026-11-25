import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, elevation, gradients, radius, spacing, type GradientToken } from '@/theme';

import { IconBadge, type IconBadgeTone } from './IconBadge';
import { Text } from './Text';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  tone: IconBadgeTone;
  gradient: Extract<GradientToken, 'lavender' | 'sage' | 'coral' | 'warm'>;
  title: string;
  subtitle: string;
  onPress: () => void;
  testID?: string;
};

/** Tinted tile with icon, title and one-line description. Use in equal-width rows/grids. */
export function ActionCard({ icon, tone, gradient, title, subtitle, onPress, testID }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      testID={testID}
      style={({ pressed }) => [styles.outer, pressed && styles.pressed]}
    >
      <LinearGradient
        colors={gradients[gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.top}>
          <IconBadge name={icon} tone={tone} />
          <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
        </View>
        <View style={styles.text}>
          <Text variant="subheading" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={2} style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, borderRadius: radius.xl, backgroundColor: colors.surface, ...elevation.card },
  pressed: { transform: [{ scale: 0.98 }] },
  card: {
    flex: 1,
    minHeight: 132,
    borderRadius: radius.xl,
    padding: spacing.lg,
    justifyContent: 'flex-start',
    gap: spacing.lg,
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  text: { gap: spacing.xxs },
  // Always reserve two lines so titles align across tiles in a row.
  subtitle: { minHeight: 36 },
});
