import { apiClient } from '@/api';

import type { AppNotification, NotificationPage } from './types';

export const listNotifications = (before?: string | null): Promise<NotificationPage> =>
  apiClient.request(`/notifications${before ? `?before=${encodeURIComponent(before)}` : ''}`);

export const getUnreadCount = (): Promise<{ unread_count: number }> =>
  apiClient.request('/notifications/unread-count');

export const markRead = (id: string): Promise<AppNotification> =>
  apiClient.request(`/notifications/${id}/read`, { method: 'POST' });

export const markAllRead = (): Promise<{ unread_count: number }> =>
  apiClient.request('/notifications/read-all', { method: 'POST' });

export const registerDevice = (token: string, platform: 'android' | 'ios'): Promise<void> =>
  apiClient.request('/me/push-devices', { method: 'POST', body: { token, platform } });

export const unregisterDevice = (token: string): Promise<void> =>
  apiClient.request('/me/push-devices/unregister', { method: 'POST', body: { token } });
