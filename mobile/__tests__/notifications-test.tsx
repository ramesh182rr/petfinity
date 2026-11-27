import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { renderRouter } from 'expo-router/testing-library';

import { createQueryClient } from '@/api';
import { completeSignIn, resetSessionForTests } from '@/features/auth/session';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { notificationIcon, sectionFor, timeAgo } from '@/features/notifications/format';
import { RootNavigator } from '@/navigation/RootNavigator';

import NotificationsScreen from '../app/notifications';

import { createFakeApi, tokens, USER, type FakeApi } from './helpers/fakeApi';

function Root() {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <RootNavigator />
    </QueryClientProvider>
  );
}

const BookingStub = () => null;
const routes = {
  _layout: Root,
  index: () => <NotificationBell />,
  notifications: NotificationsScreen,
  'provider/booking/[id]': BookingStub,
};

const now = new Date().toISOString();
const note = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  kind: 'booking_request',
  title: 'New request: Kitty · Home check-up',
  body: 'Lakshmi Iyer asked for Tue 1 Dec, 9:00 am. Reply by 12:42 am.',
  data: { route: '/provider/booking/b-1', booking_id: 'b-1' },
  read_at: null as string | null,
  created_at: now,
  ...over,
});

let api: FakeApi;

beforeEach(async () => {
  resetSessionForTests();
  api = createFakeApi();
  globalThis.fetch = api.fetch;
  await completeSignIn({
    ...tokens(1),
    user: { ...USER, display_name: 'Priya' },
    is_new_user: false,
  });
});

describe('notifications', () => {
  it('shows the unread badge on the bell', async () => {
    api.on('GET', '/notifications/unread-count', () => [200, { unread_count: 12 }]);
    await renderRouter(routes, { initialUrl: '/' });
    expect(await screen.findByTestId('notification-badge')).toHaveTextContent('9+');
    expect(screen.getByLabelText('Notifications, 12 unread')).toBeOnTheScreen();
  });

  it('lists notifications, opens one and marks it read', async () => {
    let items = [
      note('n-1'),
      note('n-2', { kind: 'booking_confirmed', title: 'Confirmed', read_at: now }),
    ];
    api.on('GET', '/notifications', () => [
      200,
      { items, unread_count: items.filter((n) => !n.read_at).length, next_before: null },
    ]);
    api.on('GET', '/notifications/unread-count', () => [
      200,
      { unread_count: items.filter((n) => !n.read_at).length },
    ]);
    api.on('POST', '/notifications/n-1/read', () => {
      items = items.map((n) => (n.id === 'n-1' ? { ...n, read_at: now } : n));
      return [200, items[0]];
    });

    await renderRouter(routes, { initialUrl: '/notifications' });
    expect(await screen.findByText('1 new')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Unread\. New request/)).toBeOnTheScreen();
    expect(screen.getByTestId('push-card')).toBeOnTheScreen(); // permission not asked yet

    await fireEvent.press(screen.getByTestId('notification-n-1'));
    await waitFor(() => expect(screen).toHavePathname('/provider/booking/b-1'));
    expect(api.calls.some((c) => c.method === 'POST' && c.path === '/notifications/n-1/read')).toBe(
      true,
    );
  });

  it('marks everything read', async () => {
    let unread = 2;
    api.on('GET', '/notifications', () => [
      200,
      { items: [note('n-1'), note('n-2')], unread_count: unread, next_before: null },
    ]);
    api.on('GET', '/notifications/unread-count', () => [200, { unread_count: unread }]);
    api.on('POST', '/notifications/read-all', () => {
      unread = 0;
      return [200, { unread_count: 0 }];
    });
    await renderRouter(routes, { initialUrl: '/notifications' });
    await fireEvent.press(await screen.findByTestId('mark-all-read'));
    expect(await screen.findByText('All caught up')).toBeOnTheScreen();
  });

  it('asks for push permission only when the user taps the button', async () => {
    api.on('GET', '/notifications', () => [200, { items: [], unread_count: 0, next_before: null }]);
    api.on('GET', '/notifications/unread-count', () => [200, { unread_count: 0 }]);
    await renderRouter(routes, { initialUrl: '/notifications' });
    expect(await screen.findByTestId('notifications-empty')).toBeOnTheScreen();
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('push-enable'));
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(await screen.findByTestId('push-message')).toHaveTextContent(/Settings/);
  });
});

describe('notification formatting', () => {
  it('picks icons and relative times', () => {
    expect(notificationIcon('reminder_2h').icon).toBe('alarm');
    expect(notificationIcon('booking_cancelled').tone).toBe('coral');
    expect(notificationIcon('something_else').icon).toBe('notifications');
    const at = new Date(2026, 10, 27, 22, 0);
    expect(timeAgo(new Date(2026, 10, 27, 21, 59, 30).toISOString(), at)).toBe('now');
    expect(timeAgo(new Date(2026, 10, 27, 21, 15).toISOString(), at)).toBe('45 min');
    expect(timeAgo(new Date(2026, 10, 27, 18, 0).toISOString(), at)).toBe('4 h');
    expect(timeAgo(new Date(2026, 10, 26, 18, 0).toISOString(), at)).toBe('Yesterday');
    expect(sectionFor(new Date(2026, 10, 27, 9).toISOString(), at)).toBe('Today');
    expect(sectionFor(new Date(2026, 10, 25, 9).toISOString(), at)).toBe('Earlier');
  });
});
