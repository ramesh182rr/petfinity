import { colors } from '@/theme';

/**
 * For screens whose gradient hero runs under the navigation header: no title,
 * no background (the root stack's cream header background must be cleared too),
 * white back button.
 */
export const transparentHeader = {
  title: '',
  headerTransparent: true,
  headerStyle: { backgroundColor: 'transparent' },
  headerTintColor: colors.textOnPrimary,
} as const;
