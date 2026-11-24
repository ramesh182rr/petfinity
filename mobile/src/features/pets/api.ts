import { apiClient } from '@/api';
import { resolveMediaUrl } from '@/api/urls';

import type { Pet, PetCreate, PetUpdate, PhotoUploadResponse } from './types';

export const listPets = (): Promise<Pet[]> => apiClient.request('/pets');
export const getPet = (id: string): Promise<Pet> => apiClient.request(`/pets/${id}`);
export const createPet = (body: PetCreate): Promise<Pet> =>
  apiClient.request('/pets', { method: 'POST', body });
export const updatePet = (id: string, body: PetUpdate): Promise<Pet> =>
  apiClient.request(`/pets/${id}`, { method: 'PATCH', body });
export const deletePet = (id: string): Promise<void> =>
  apiClient.request(`/pets/${id}`, { method: 'DELETE' });
export const removePetPhoto = (id: string): Promise<Pet> =>
  apiClient.request(`/pets/${id}/photo`, { method: 'DELETE' });

export type PreparedImage = { uri: string; contentType: 'image/jpeg'; blob: Blob };

/**
 * Signed-URL upload (decision 0008): ask for an upload URL, PUT the bytes
 * straight to storage (R2 or local dev), then confirm so the API verifies it.
 */
export async function uploadPetPhoto(
  petId: string,
  image: PreparedImage,
  fetchImpl: typeof fetch = (...args) => globalThis.fetch(...args),
): Promise<Pet> {
  const ticket = await apiClient.request<PhotoUploadResponse>(`/pets/${petId}/photo/upload-url`, {
    method: 'POST',
    body: { content_type: image.contentType, size_bytes: image.blob.size },
  });
  const uploadUrl = resolveMediaUrl(ticket.upload.url);
  if (!uploadUrl) throw new Error('Missing upload URL');
  const response = await fetchImpl(uploadUrl, {
    method: ticket.upload.method,
    headers: ticket.upload.headers,
    body: image.blob,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
  return apiClient.request<Pet>(`/pets/${petId}/photo`, {
    method: 'PUT',
    body: { media_id: ticket.media_id },
  });
}
