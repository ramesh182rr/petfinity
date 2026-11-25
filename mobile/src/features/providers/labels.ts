import type { PillTone } from '@/components/ui';

import type { DocumentType, ProviderType, VerificationStatus } from './types';

export const DOC_INFO: Record<DocumentType, { label: string; hint: string }> = {
  identity: { label: 'Government ID', hint: 'Aadhaar, PAN, passport or driving licence' },
  vet_registration: {
    label: 'Council registration',
    hint: 'Your state veterinary council certificate',
  },
  qualification: { label: 'Qualification', hint: 'Degree certificate, e.g. B.V.Sc. & A.H.' },
  clinic_registration: {
    label: 'Clinic registration',
    hint: 'Shop & establishment or trade licence',
  },
  address_proof: { label: 'Address proof', hint: 'Utility bill, rent agreement or similar' },
  other: { label: 'Other document', hint: 'Anything else that helps us verify you' },
};

export const OPTIONAL_DOCS: Record<'veterinarian' | 'caretaker' | 'clinic', DocumentType[]> = {
  veterinarian: ['qualification', 'other'],
  caretaker: ['address_proof', 'other'],
  clinic: ['address_proof', 'other'],
};

export const PROVIDER_LABEL: Record<ProviderType, string> = {
  veterinarian: 'Veterinarian',
  caretaker: 'Pet caretaker',
};

export const STATUS_INFO: Record<
  VerificationStatus,
  { label: string; tone: PillTone; message: string }
> = {
  draft: {
    label: 'Not submitted',
    tone: 'neutral',
    message: 'Add the required details and documents, then submit for review.',
  },
  submitted: {
    label: 'Under review',
    tone: 'warning',
    message: 'Our team is checking your documents. We’ll let you know the outcome.',
  },
  needs_info: {
    label: 'Action needed',
    tone: 'warning',
    message: 'We need a little more information. See the note from our team below.',
  },
  verified: {
    label: 'Verified',
    tone: 'success',
    message: 'Your identity and documents were checked by Petfinity.',
  },
  rejected: {
    label: 'Not approved',
    tone: 'error',
    message: 'We couldn’t verify this. See the note below; you can update and resubmit.',
  },
};

export const FIELD_LABELS: Record<string, string> = {
  registration_number: 'Registration number',
  registration_council: 'Registration council',
};

export const LANGUAGES = ['Tamil', 'Malayalam', 'Kannada', 'English', 'Hindi', 'Telugu'];
export const COUNCILS = [
  'Tamil Nadu State Veterinary Council',
  'Kerala State Veterinary Council',
  'Karnataka Veterinary Council',
  'Veterinary Council of India',
];
export const STATES = ['Tamil Nadu', 'Kerala', 'Karnataka'];
