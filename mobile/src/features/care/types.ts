import type { components } from '@/api/generated/schema';

type S = components['schemas'];
export type CareType = S['CareType'];
export type CareService = S['CareServiceOut'];
export type CareServiceIn = S['CareServiceIn'];
export type CareWorkspace = S['CareWorkspace'];
export type ReadinessItem = S['CareWorkspace']['missing'][number];
