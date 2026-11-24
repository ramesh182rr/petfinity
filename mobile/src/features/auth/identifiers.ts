import { z } from 'zod';

import type { Channel } from './types';

/**
 * Client-side validation mirrors the server (backend/app/modules/auth/identifiers.py)
 * for instant feedback. The server remains the source of truth.
 */
const INDIA_MOBILE = /^[6-9]\d{9}$/;

export function normalizeIndianMobile(raw: string): string | null {
  let digits = raw.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('0091')) digits = digits.slice(4);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return INDIA_MOBILE.test(digits) ? `+91${digits}` : null;
}

/** Contact numbers (not sign-in): Indian mobiles and landlines, e.g. 044 2345 6789. Mirrors the server. */
export function normalizeIndianContact(raw: string): string | null {
  let value = raw.replace(/[\s\-().]/g, '');
  if (value.startsWith('00')) value = `+${value.slice(2)}`;
  if (!value.startsWith('+')) {
    if (value.length === 11 && value.startsWith('0') && value[1] !== '0')
      value = `+91${value.slice(1)}`;
    else if (value.length === 10 && value[0] !== '0') value = `+91${value}`;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(value)) return null;
  if (value.startsWith('+91') && !/^\+91[1-9]\d{9}$/.test(value)) return null;
  return value;
}

export const emailFormSchema = z.object({
  destination: z
    .string()
    .trim()
    .min(1, 'Enter your email address.')
    .pipe(z.email('Enter a valid email address.')),
});

export const phoneFormSchema = z.object({
  destination: z
    .string()
    .trim()
    .min(1, 'Enter your mobile number.')
    .refine((value) => normalizeIndianMobile(value) !== null, {
      message: 'Enter a valid 10-digit Indian mobile number.',
    }),
});

export type DestinationForm = { destination: string };

export function schemaFor(channel: Channel) {
  return channel === 'email' ? emailFormSchema : phoneFormSchema;
}

/** Value sent to the API. */
export function toApiDestination(channel: Channel, value: string): string {
  return channel === 'email' ? value.trim().toLowerCase() : (normalizeIndianMobile(value) ?? value);
}

export const displayNameSchema = z.object({
  displayName: z
    .string()
    .transform((value) => value.split(/\s+/).filter(Boolean).join(' '))
    .pipe(
      z.string().min(1, 'Tell us what to call you.').max(60, 'Please keep it under 60 characters.'),
    ),
});
