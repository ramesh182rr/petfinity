import type { components } from '@/api/generated/schema';

type S = components['schemas'];
export type AppNotification = S['NotificationOut'];
export type NotificationPage = S['NotificationPage'];
