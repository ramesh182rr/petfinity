import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchMe } from '@/features/auth/api';
import { setUser } from '@/features/auth/session';

import * as api from './api';
import type {
  ClinicCreate,
  ClinicUpdate,
  DocumentType,
  ProviderProfileCreate,
  ProviderProfileUpdate,
  SubjectType,
} from './types';

export const providerKeys = {
  profiles: ['provider', 'profiles'] as const,
  profile: (id: string) => ['provider', 'profiles', id] as const,
  clinics: ['provider', 'clinics'] as const,
  clinic: (id: string) => ['provider', 'clinics', id] as const,
  verification: (type: SubjectType, id: string) => ['provider', 'verification', type, id] as const,
};

/** Capabilities in /me change when profiles/clinics are created. */
async function refreshMe() {
  try {
    setUser(await fetchMe());
  } catch {
    // non-critical: capabilities refresh on next launch
  }
}

export const useProviderProfiles = () =>
  useQuery({ queryKey: providerKeys.profiles, queryFn: api.listProfiles });
export const useProviderProfile = (id: string, enabled = true) =>
  useQuery({
    queryKey: providerKeys.profile(id),
    queryFn: () => api.getProfile(id),
    enabled: enabled && !!id,
  });
export const useMyClinics = () =>
  useQuery({ queryKey: providerKeys.clinics, queryFn: api.listClinics });
export const useClinic = (id: string, enabled = true) =>
  useQuery({
    queryKey: providerKeys.clinic(id),
    queryFn: () => api.getClinic(id),
    enabled: enabled && !!id,
  });
export const useVerification = (type: SubjectType, id: string) =>
  useQuery({
    queryKey: providerKeys.verification(type, id),
    queryFn: () => api.getVerification(type, id),
  });

export function useCreateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProviderProfileCreate) => api.createProfile(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: providerKeys.profiles });
      await refreshMe();
    },
  });
}

export function useUpdateProfile(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProviderProfileUpdate) => api.updateProfile(id, body),
    onSuccess: (profile) => {
      qc.setQueryData(providerKeys.profile(id), profile);
      void qc.invalidateQueries({ queryKey: ['provider'] });
    },
  });
}

export function useCreateClinic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClinicCreate) => api.createClinic(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: providerKeys.clinics });
      await refreshMe();
    },
  });
}

export function useUpdateClinic(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ClinicUpdate) => api.updateClinic(id, body),
    onSuccess: (clinic) => {
      qc.setQueryData(providerKeys.clinic(id), clinic);
      void qc.invalidateQueries({ queryKey: ['provider'] });
    },
  });
}

function useInvalidateVerification(type: SubjectType, id: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['provider'] });
}

export function useUploadDocument(type: SubjectType, id: string) {
  const invalidate = useInvalidateVerification(type, id);
  return useMutation({
    mutationFn: ({ docType, file }: { docType: DocumentType; file: api.PickedFile }) =>
      api.uploadDocument(type, id, docType, file),
    onSuccess: invalidate,
  });
}

export function useDeleteDocument(type: SubjectType, id: string) {
  const invalidate = useInvalidateVerification(type, id);
  return useMutation({
    mutationFn: (documentId: string) => api.deleteDocument(type, id, documentId),
    onSuccess: invalidate,
  });
}

export function useSubmitForReview(type: SubjectType, id: string) {
  const invalidate = useInvalidateVerification(type, id);
  return useMutation({
    mutationFn: (note: string | null) => api.submitForReview(type, id, note),
    onSuccess: invalidate,
  });
}
