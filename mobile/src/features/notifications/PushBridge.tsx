import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';

import { useSession } from '@/features/auth/session';

import { markRead } from './api';
import { notificationKeys } from './hooks';
import { configureForegroundPushes, setUpPush } from './push';

configureForegroundPushes();

function openFrom(response: Notifications.NotificationResponse | null) {
  const data = response?.notification.request.content.data as
    { route?: unknown; notification_id?: unknown } | undefined;
  if (typeof data?.notification_id === 'string') {
    void markRead(data.notification_id).catch(() => undefined);
  }
  // Only in-app routes: never follow anything that isn't a path.
  if (typeof data?.route === 'string' && data.route.startsWith('/')) {
    router.push(data.route as Href);
  }
}

/**
 * Keeps push in sync while signed in: re-registers silently when permission was
 * already given, refreshes the inbox when a push arrives, and opens the right
 * screen when one is tapped. Renders nothing.
 */
export function PushBridge() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const qc = useQueryClient();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (signedIn) void setUpPush({ ask: false });
  }, [signedIn]);

  useEffect(() => {
    if (signedIn && lastResponse) openFrom(lastResponse);
  }, [signedIn, lastResponse]);

  useEffect(() => {
    const received = Notifications.addNotificationReceivedListener(() => {
      void qc.invalidateQueries({ queryKey: notificationKeys.all });
      void qc.invalidateQueries({ queryKey: ['bookings'] });
    });
    return () => received.remove();
  }, [qc]);

  return null;
}
