import { apiClient } from '@/api';
import type { OwnerType } from '@/features/catalog/types';
import type { ListingKind } from '@/features/discovery/types';

import type {
  MyReview,
  ProviderReview,
  ProviderReviewPage,
  ReportReason,
  ReviewPage,
} from './types';

const plural = (kind: ListingKind) => (kind === 'clinic' ? 'clinics' : 'vets');

export const listingReviews = (
  kind: ListingKind,
  id: string,
  before?: string | null,
): Promise<ReviewPage> =>
  apiClient.request(
    `/discover/${plural(kind)}/${id}/reviews${before ? `?before=${encodeURIComponent(before)}` : ''}`,
  );

export const createReview = (
  bookingId: string,
  body: { rating: number; text: string | null },
): Promise<MyReview> =>
  apiClient.request(`/bookings/${bookingId}/review`, { method: 'POST', body });

export const updateReview = (
  id: string,
  body: { rating?: number; text?: string | null },
): Promise<MyReview> => apiClient.request(`/reviews/${id}`, { method: 'PATCH', body });

export const reportReview = (
  id: string,
  body: { reason: ReportReason; note?: string | null },
): Promise<void> => apiClient.request(`/reviews/${id}/report`, { method: 'POST', body });

export const replyToReview = (id: string, text: string): Promise<ProviderReview> =>
  apiClient.request(`/reviews/${id}/reply`, { method: 'PUT', body: { text } });

export const providerReviews = (ownerType: OwnerType, id: string): Promise<ProviderReviewPage> =>
  apiClient.request(`/manage/${ownerType}/${id}/reviews`);
