import type { components } from '@/api/generated/schema';

type S = components['schemas'];
export type Service = S['ServiceResponse'];
export type ServiceCreate = S['ServiceCreate'];
export type ServiceUpdate = S['ServiceUpdate'];
export type ServiceCategory = S['ServiceCategory'];
export type ServiceMode = S['ServiceMode'];
export type ConfirmationMode = S['ConfirmationMode'];
export type Rule = S['RuleIn'];
export type WeeklyHours = S['WeeklyHoursResponse'];
export type DayException = S['ExceptionOut'];
export type DayExceptionIn = S['ExceptionIn'];
export type SlotPreview = S['SlotPreview'];
export type OwnerType = S['OwnerType'];
