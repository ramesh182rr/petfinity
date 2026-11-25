import { router } from 'expo-router';

import type { OwnerType } from './types';

/**
 * Leave an editor screen. Goes back when there is history; otherwise (opened from
 * a deep link or notification) replaces it with the owner's workspace.
 */
export function backToWorkspace(ownerType: OwnerType, ownerId: string) {
  if (router.canGoBack()) router.back();
  else router.replace(`/provider/manage/${ownerType}/${ownerId}`);
}
