import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, elevation } from '@/theme';

/** Track whether a hero screen has scrolled past its gradient header. */
export function useHeroScroll(threshold = 120) {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const past = e.nativeEvent.contentOffset.y > threshold;
    if (past !== scrolled) setScrolled(past);
  };
  return { scrolled, onScroll, scrollEventThrottle: 32 } as const;
}

/**
 * Over the plum hero: light status-bar icons, no background.
 * Once scrolled past it: a cream bar behind the status bar with dark icons,
 * so content never collides with the clock.
 */
export function StatusBarScrim({ scrolled }: { scrolled: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <StatusBar style={scrolled ? 'dark' : 'light'} />
      {scrolled ? (
        <View pointerEvents="none" style={[styles.scrim, { height: insets.top }]} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    ...elevation.card,
  },
});
