import { apiClient } from '@/api';
import { resolveMediaUrl } from '@/api/urls';

import type {
  Clinic,
  ClinicCreate,
  ClinicUpdate,
  DocumentType,
  DocumentUploadResponse,
  ProviderProfile,
  ProviderProfileCreate,
  ProviderProfileUpdate,
  SubjectType,
  VerificationDocument,
  VerificationOverview,
} from './types';

export const listProfiles = (): Promise<ProviderProfile[]> =>
  apiClient.request('/me/provider-profiles');
export const getProfile = (id: string): Promise<ProviderProfile> =>
  apiClient.request(`/me/provider-profiles/${id}`);
export const createProfile = (body: ProviderProfileCreate): Promise<ProviderProfile> =>
  apiClient.request('/me/provider-profiles', { method: 'POST', body });
export const updateProfile = (id: string, body: ProviderProfileUpdate): Promise<ProviderProfile> =>
  apiClient.request(`/me/provider-profiles/${id}`, { method: 'PATCH', body });

export const listClinics = (): Promise<Clinic[]> => apiClient.request('/me/clinics');
export const getClinic = (id: string): Promise<Clinic> => apiClient.request(`/clinics/${id}`);
export const createClinic = (body: ClinicCreate): Promise<Clinic> =>
  apiClient.request('/clinics', { method: 'POST', body });
export const updateClinic = (id: string, body: ClinicUpdate): Promise<Clinic> =>
  apiClient.request(`/clinics/${id}`, { method: 'PATCH', body });

const base = (type: SubjectType, id: string) => `/verification/${type}/${id}`;

export const getVerification = (type: SubjectType, id: string): Promise<VerificationOverview> =>
  apiClient.request(base(type, id));
export const deleteDocument = (type: SubjectType, id: string, documentId: string): Promise<void> =>
  apiClient.request(`${base(type, id)}/documents/${documentId}`, { method: 'DELETE' });
export const submitForReview = (type: SubjectType, id: string, note: string | null) =>
  apiClient.request(`${base(type, id)}/submit`, { method: 'POST', body: { note } });

export type PickedFile = { uri: string; name: string; contentType: string; blob: Blob };

/** Signed-URL upload (decision 0008) of a private verification document. */
export async function uploadDocument(
  type: SubjectType,
  id: string,
  docType: DocumentType,
  file: PickedFile,
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): Promise<VerificationDocument> {
  const ticket = await apiClient.request<DocumentUploadResponse>(
    `${base(type, id)}/documents/upload-url`,
    {
      method: 'POST',
      body: { doc_type: docType, content_type: file.contentType, size_bytes: file.blob.size },
    },
  );
  const url = resolveMediaUrl(ticket.upload.url);
  if (!url) throw new Error('Missing upload URL');
  const response = await fetchImpl(url, {
    method: ticket.upload.method,
    headers: ticket.upload.headers,
    body: file.blob,
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  return apiClient.request<VerificationDocument>(`${base(type, id)}/documents`, {
    method: 'POST',
    body: { media_id: ticket.media_id, doc_type: docType },
  });
}
