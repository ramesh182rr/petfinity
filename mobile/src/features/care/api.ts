import { apiClient } from '@/api';
import type { BookingDetail } from '@/features/bookings/types';

import type {
  CareRequest,
  CareRequestIn,
  CareServiceIn,
  CaretakerRequest,
  CareWorkspace,
  OfferIn,
} from './types';

const base = (id: string) => `/manage/provider_profile/${id}/care`;

export const getCare = (id: string): Promise<CareWorkspace> => apiClient.request(base(id));

export const putServices = (id: string, services: CareServiceIn[]): Promise<CareWorkspace> =>
  apiClient.request(`${base(id)}/services`, { method: 'PUT', body: { services } });

// ---- parent: care requests (3.4) -------------------------------------------------

export const createRequest = (body: CareRequestIn): Promise<CareRequest> =>
  apiClient.request('/care-requests', { method: 'POST', body });

export const listRequests = (scope: 'active' | 'past'): Promise<{ items: CareRequest[] }> =>
  apiClient.request(`/care-requests?scope=${scope}`);

export const getRequest = (id: string): Promise<CareRequest> =>
  apiClient.request(`/care-requests/${id}`);

export const cancelRequest = (id: string): Promise<CareRequest> =>
  apiClient.request(`/care-requests/${id}/cancel`, { method: 'POST' });

export const acceptOffer = (requestId: string, offerId: string): Promise<BookingDetail> =>
  apiClient.request(`/care-requests/${requestId}/offers/${offerId}/accept`, { method: 'POST' });

// ---- caretaker: feed and offers (3.5) --------------------------------------------

const feedBase = (profileId: string) => `/manage/provider_profile/${profileId}/care/requests`;

export const listFeed = (
  profileId: string,
  scope: 'open' | 'offered',
): Promise<{ items: CaretakerRequest[] }> =>
  apiClient.request(`${feedBase(profileId)}?scope=${scope}`);

export const getFeedItem = (profileId: string, id: string): Promise<CaretakerRequest> =>
  apiClient.request(`${feedBase(profileId)}/${id}`);

export const putOffer = (profileId: string, id: string, body: OfferIn): Promise<CaretakerRequest> =>
  apiClient.request(`${feedBase(profileId)}/${id}/offer`, { method: 'PUT', body });

export const withdrawOffer = (profileId: string, id: string): Promise<void> =>
  apiClient.request(`${feedBase(profileId)}/${id}/offer`, { method: 'DELETE' });
