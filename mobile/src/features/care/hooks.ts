import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as api from './api';
import type { CareServiceIn } from './types';

export const careKeys = { workspace: (id: string) => ['care', id] as const };

export const useCare = (id: string) =>
  useQuery({ queryKey: careKeys.workspace(id), queryFn: () => api.getCare(id) });

export function useSaveCareServices(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (services: CareServiceIn[]) => api.putServices(id, services),
    onSuccess: (data) => qc.setQueryData(careKeys.workspace(id), data),
  });
}

export const requestKeys = {
  all: ['care-requests'] as const,
  list: (scope: 'active' | 'past') => ['care-requests', 'list', scope] as const,
  detail: (id: string) => ['care-requests', 'detail', id] as const,
  feed: (profileId: string, scope: 'open' | 'offered') =>
    ['care-requests', 'feed', profileId, scope] as const,
  feedItem: (profileId: string, id: string) =>
    ['care-requests', 'feed-item', profileId, id] as const,
};

export const useCareRequests = (scope: 'active' | 'past') =>
  useQuery({ queryKey: requestKeys.list(scope), queryFn: () => api.listRequests(scope) });

export const useCareRequest = (id: string) =>
  useQuery({ queryKey: requestKeys.detail(id), queryFn: () => api.getRequest(id) });

export function useCreateCareRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createRequest,
    onSuccess: (r) => {
      qc.setQueryData(requestKeys.detail(r.id), r);
      void qc.invalidateQueries({ queryKey: ['care-requests', 'list'] });
    },
  });
}

export function useCancelCareRequest(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.cancelRequest(id),
    onSuccess: (r) => {
      qc.setQueryData(requestKeys.detail(id), r);
      void qc.invalidateQueries({ queryKey: ['care-requests', 'list'] });
    },
  });
}

export function useAcceptOffer(requestId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (offerId: string) => api.acceptOffer(requestId, offerId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: requestKeys.all });
      void qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });
}

export const useCareFeed = (profileId: string, scope: 'open' | 'offered') =>
  useQuery({
    queryKey: requestKeys.feed(profileId, scope),
    queryFn: () => api.listFeed(profileId, scope),
  });

export const useCareFeedItem = (profileId: string, id: string) =>
  useQuery({
    queryKey: requestKeys.feedItem(profileId, id),
    queryFn: () => api.getFeedItem(profileId, id),
  });

export function useSendOffer(profileId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { price_minor: number; message: string | null }) =>
      api.putOffer(profileId, id, body),
    onSuccess: (item) => {
      qc.setQueryData(requestKeys.feedItem(profileId, id), item);
      void qc.invalidateQueries({ queryKey: ['care-requests', 'feed', profileId] });
    },
  });
}

export function useWithdrawOffer(profileId: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.withdrawOffer(profileId, id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: requestKeys.all }),
  });
}
