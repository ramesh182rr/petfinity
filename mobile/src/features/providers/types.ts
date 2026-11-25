import type { components } from '@/api/generated/schema';

type S = components['schemas'];
export type ProviderProfile = S['ProviderProfileResponse'];
export type ProviderProfileCreate = S['ProviderProfileCreate'];
export type ProviderProfileUpdate = S['ProviderProfileUpdate'];
export type ProviderType = S['ProviderType'];
export type Clinic = S['ClinicResponse'];
export type ClinicCreate = S['ClinicCreate'];
export type ClinicUpdate = S['ClinicUpdate'];
export type VerificationOverview = S['VerificationOverview'];
export type VerificationStatus = S['VerificationStatus'];
export type DocumentType = S['DocumentType'];
export type VerificationDocument = S['DocumentResponse'];
export type SubjectType = S['SubjectType'];
export type DocumentUploadResponse = S['DocumentUploadResponse'];
