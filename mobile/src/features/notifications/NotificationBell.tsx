import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, fonts, radius } from '@/theme';

import { useUnreadCount } from './hooks';

/** Round bell for gradient headers, with an unread badge (9+ above nine). */
export function NotificationBell({ size = 48 }: { size?: number }) {
  const unread = useUnreadCount();
  const count = unread.data ?? 0;
  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={count ? `Notifications, ${count} unread` : 'Notifications'}
      hitSlop={8}
      testID="notification-bell"
      style={({ pressed }) => [
        styles.bell,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.textOnPrimary} />
      {count ? (
        <View style={styles.badge} testID="notification-badge">
          <Text style={styles.badgeText}>{count > 9 ? '9+' : String(count)}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bell: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  pressed: { opacity: 0.8 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  badgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 13,
    color: colors.textOnPrimary,
  },
});
