import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Refetch when a screen regains focus (e.g. returning from another screen), so
 * status that may change server-side (verification decisions) is never stale.
 * Skips the first focus: the query has just fetched on mount.
 */
export function useRefreshOnFocus(...refetchers: (() => unknown)[]) {
  const firstFocus = useRef(true);
  const latest = useRef(refetchers);
  useEffect(() => {
    latest.current = refetchers;
  });
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      latest.current.forEach((refetch) => void refetch());
    }, []),
  );
}
