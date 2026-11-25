import type { ComponentProps, ReactElement, ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';

import { colors, spacing } from '@/theme';

import { HeroHeader } from './HeroHeader';
import { StatusBarScrim, useHeroScroll } from './StatusBarScrim';

type Props = Omit<ComponentProps<typeof HeroHeader>, 'children' | 'edgeToEdge' | 'style'> & {
  heroContent?: ReactNode;
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Pull the first body element up over the hero's rounded bottom. */
  overlap?: boolean;
};

/** Standard Petfinity screen: gradient hero header + padded scrolling body. */
export function HeroScreen({
  heroContent,
  children,
  refreshControl,
  overlap = false,
  testID,
  ...hero
}: Props) {
  const scroll = useHeroScroll();
  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        onScroll={scroll.onScroll}
        scrollEventThrottle={scroll.scrollEventThrottle}
        testID={testID}
      >
        <HeroHeader edgeToEdge {...hero} style={overlap ? styles.heroOverlap : undefined}>
          {heroContent}
        </HeroHeader>
        <View style={[styles.body, overlap && styles.bodyOverlap]}>{children}</View>
      </ScrollView>
      <StatusBarScrim scrolled={scroll.scrolled} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  heroOverlap: { paddingBottom: spacing.xxxl },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, gap: spacing.xl },
  bodyOverlap: { marginTop: -spacing.xxl, paddingTop: 0 },
});
