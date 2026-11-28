import type { components } from '@/api/generated/schema';

type S = components['schemas'];
export type CareType = S['CareType'];
export type CareService = S['CareServiceOut'];
export type CareServiceIn = S['CareServiceIn'];
export type CareWorkspace = S['CareWorkspace'];
export type ReadinessItem = S['CareWorkspace']['missing'][number];
export type CareRequestIn = S['CareRequestIn'];
export type CareRequest = S['CareRequestOut'];
export type CareOffer = S['CareOfferOut'];
export type CarePet = S['CarePetOut'];
export type CareRequestStatus = S['CareRequestStatus'];
export type CaretakerRequest = S['CareRequestForCaretaker'];
export type OfferIn = S['OfferIn'];
