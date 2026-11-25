import type Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Animated, StyleSheet, View, type DimensionValue } from 'react-native';

import { Button, IconBadge, Text, type IconBadgeTone } from '@/components/ui';
import { colors, palette, radius, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Action = { label: string; onPress: () => void };

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text variant="body" color="textMuted" align="center" accessibilityLiveRegion="polite">
        {message}
      </Text>
    </View>
  );
}

/** Pulsing placeholder block for skeleton layouts. */
export function Skeleton({
  width = '100%',
  height = 16,
  rounded = false,
}: {
  width?: DimensionValue;
  height?: number;
  rounded?: boolean;
}) {
  const [opacity] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.skeleton,
        { width, height, opacity, borderRadius: rounded ? radius.pill : radius.sm },
      ]}
    />
  );
}

type EmptyStateProps = {
  icon: IconName;
  tone?: IconBadgeTone;
  title: string;
  message: string;
  action?: Action;
  /** Tighter spacing and a smaller icon, for use inside cards. */
  compact?: boolean;
  testID?: string;
};

const HALO: Record<IconBadgeTone, string> = {
  lavender: palette.plum300,
  sage: palette.sage400,
  coral: palette.coral400,
  peach: palette.peach400,
};

export function EmptyState({
  icon,
  tone = 'lavender',
  title,
  message,
  action,
  compact = false,
  testID,
}: EmptyStateProps) {
  return (
    <View style={[styles.center, compact && styles.compact]} testID={testID}>
      <View style={[styles.halo, compact ? styles.haloCompact : styles.haloLarge]}>
        <View style={[styles.haloRing, { backgroundColor: HALO[tone] }]} />
        <IconBadge name={icon} tone={tone} size={compact ? 'md' : 'lg'} />
      </View>
      <View style={styles.copy}>
        <Text variant="heading" align="center">
          {title}
        </Text>
        <Text variant="body" color="textMuted" align="center">
          {message}
        </Text>
      </View>
      {action ? <Button label={action.label} onPress={action.onPress} variant="secondary" /> : null}
    </View>
  );
}

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Shown small so users can quote it to support. */
  requestId?: string | null;
  testID?: string;
};

export function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't load this right now. Check your connection and try again.",
  onRetry,
  requestId,
  testID,
}: ErrorStateProps) {
  return (
    <View style={styles.center} testID={testID} accessibilityRole="alert">
      <IconBadge name="cloud-offline-outline" tone="coral" size="lg" />
      <View style={styles.copy}>
        <Text variant="heading" align="center">
          {title}
        </Text>
        <Text variant="body" color="textMuted" align="center">
          {message}
        </Text>
      </View>
      {onRetry ? <Button label="Try again" icon="refresh" onPress={onRetry} /> : null}
      {requestId ? (
        <Text variant="caption" color="textMuted" selectable>
          Reference: {requestId}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  compact: { paddingVertical: spacing.lg, gap: spacing.md },
  halo: { alignItems: 'center', justifyContent: 'center' },
  haloCompact: { width: 80, height: 80 },
  haloLarge: { width: 112, height: 112 },
  haloRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    opacity: 0.16,
  },
  copy: { gap: spacing.sm, maxWidth: 340 },
  skeleton: { backgroundColor: colors.primaryTint },
});
