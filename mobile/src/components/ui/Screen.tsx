import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  /** Scrollable content (default) or a fixed, full-height layout. */
  scroll?: boolean;
  edges?: Edge[];
  testID?: string;
};

/** Standard screen container: warm cream background, safe areas, consistent padding. */
export function Screen({ children, scroll = true, edges = ['top'], testID }: Props) {
  return (
    <SafeAreaView edges={edges} style={styles.safeArea} testID={testID}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  fill: { flex: 1 },
});
