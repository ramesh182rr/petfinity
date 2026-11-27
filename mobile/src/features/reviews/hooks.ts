import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { OwnerType } from '@/features/catalog/types';
import type { ListingKind } from '@/features/discovery/types';

import * as api from './api';
import type { ReportReason } from './types';

export const reviewKeys = {
  listing: (kind: ListingKind, id: string) => ['reviews', 'listing', kind, id] as const,
  provider: (ownerType: OwnerType, id: string) => ['reviews', 'provider', ownerType, id] as const,
};

export function useListingReviews(kind: ListingKind, id: string) {
  return useInfiniteQuery({
    queryKey: reviewKeys.listing(kind, id),
    queryFn: ({ pageParam }) => api.listingReviews(kind, id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_before ?? undefined,
  });
}

export const useProviderReviews = (ownerType: OwnerType, id: string) =>
  useQuery({
    queryKey: reviewKeys.provider(ownerType, id),
    queryFn: () => api.providerReviews(ownerType, id),
  });

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['reviews'] });
    void qc.invalidateQueries({ queryKey: ['bookings'] });
    void qc.invalidateQueries({ queryKey: ['discover'] });
  };
}

export function useSaveReview(bookingId: string, reviewId?: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: { rating: number; text: string | null }) =>
      reviewId ? api.updateReview(reviewId, body) : api.createReview(bookingId, body),
    onSuccess: refresh,
  });
}

export function useReportReview(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (body: { reason: ReportReason; note?: string | null }) =>
      api.reportReview(id, body),
    onSuccess: refresh,
  });
}

export function useReply(id: string) {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (text: string) => api.replyToReview(id, text),
    onSuccess: refresh,
  });
}
