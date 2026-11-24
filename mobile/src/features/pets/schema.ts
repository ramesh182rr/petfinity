import { z } from 'zod';

import { normalizeIndianMobile } from '@/features/auth/identifiers';

import { toIsoDate } from './format';
import type { PetCreate, Sex, Species } from './types';

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`);

const SPECIES = [
  'dog',
  'cat',
  'bird',
  'rabbit',
  'guinea_pig',
  'hamster',
  'fish',
  'turtle',
  'reptile',
  'horse',
  'cow',
  'goat',
  'other',
] as const satisfies readonly Species[];

/** Form values are strings/booleans as entered; `toPetPayload` converts them for the API. */
export const petFormSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your pet's name.").max(50, 'Name is too long.'),
    species: z.enum(SPECIES),
    speciesOther: optionalText(40, 'Species'),
    breed: optionalText(80, 'Breed'),
    sex: z.enum(['male', 'female', 'unknown']),
    dateOfBirth: z.date().max(new Date(), 'Date of birth must be in the past.').nullable(),
    dateOfBirthIsEstimate: z.boolean(),
    weightKg: z
      .string()
      .trim()
      .refine((v) => v === '' || /^\d{1,4}(\.\d{1,2})?$/.test(v), 'Enter a weight like 12.5')
      .refine(
        (v) => v === '' || (Number(v) > 0 && Number(v) <= 2000),
        'Enter a weight between 0 and 2000 kg.',
      ),
    neutered: z.enum(['yes', 'no', 'unknown']),
    temperament: optionalText(500, 'Temperament'),
    dietaryNotes: optionalText(1000, 'Diet notes'),
    allergies: optionalText(1000, 'Allergies'),
    knownConditions: optionalText(1000, 'Conditions'),
    medications: optionalText(1000, 'Medications'),
    emergencyContactName: optionalText(60, 'Contact name'),
    emergencyContactPhone: z
      .string()
      .trim()
      .refine(
        (v) =>
          v === '' ||
          /^\+[1-9]\d{7,14}$/.test(v.replace(/[\s-]/g, '')) ||
          normalizeIndianMobile(v) !== null,
        'Enter a valid phone number.',
      ),
  })
  .refine((v) => v.species !== 'other' || v.speciesOther.length > 0, {
    path: ['speciesOther'],
    message: 'Tell us what kind of pet this is.',
  });

export type PetFormValues = z.input<typeof petFormSchema>;

export const emptyPetForm: PetFormValues = {
  name: '',
  species: 'dog',
  speciesOther: '',
  breed: '',
  sex: 'unknown',
  dateOfBirth: null,
  dateOfBirthIsEstimate: false,
  weightKg: '',
  neutered: 'unknown',
  temperament: '',
  dietaryNotes: '',
  allergies: '',
  knownConditions: '',
  medications: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

const nullIfEmpty = (value: string) => (value.trim() === '' ? null : value.trim());

/** Full payload: blank optional fields become null (clears them on update). */
export function toPetPayload(values: z.output<typeof petFormSchema>): PetCreate {
  const phone = values.emergencyContactPhone.trim();
  return {
    name: values.name.trim(),
    species: values.species,
    species_other: values.species === 'other' ? nullIfEmpty(values.speciesOther) : null,
    breed: nullIfEmpty(values.breed),
    sex: values.sex as Sex,
    date_of_birth: values.dateOfBirth ? toIsoDate(values.dateOfBirth) : null,
    date_of_birth_is_estimate: values.dateOfBirth ? values.dateOfBirthIsEstimate : false,
    weight_kg: values.weightKg === '' ? null : values.weightKg,
    neutered: values.neutered === 'unknown' ? null : values.neutered === 'yes',
    temperament: nullIfEmpty(values.temperament),
    dietary_notes: nullIfEmpty(values.dietaryNotes),
    allergies: nullIfEmpty(values.allergies),
    known_conditions: nullIfEmpty(values.knownConditions),
    medications: nullIfEmpty(values.medications),
    emergency_contact_name: nullIfEmpty(values.emergencyContactName),
    emergency_contact_phone:
      phone === '' ? null : (normalizeIndianMobile(phone) ?? phone.replace(/[\s-]/g, '')),
  };
}

export function toFormValues(pet: {
  name: string;
  species: Species;
  species_other: string | null;
  breed: string | null;
  sex: Sex;
  date_of_birth: string | null;
  date_of_birth_is_estimate: boolean;
  weight_kg: string | null;
  neutered: boolean | null;
  temperament: string | null;
  dietary_notes: string | null;
  allergies: string | null;
  known_conditions: string | null;
  medications: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}): PetFormValues {
  return {
    name: pet.name,
    species: pet.species,
    speciesOther: pet.species_other ?? '',
    breed: pet.breed ?? '',
    sex: pet.sex,
    dateOfBirth: pet.date_of_birth ? new Date(`${pet.date_of_birth}T00:00:00`) : null,
    dateOfBirthIsEstimate: pet.date_of_birth_is_estimate,
    weightKg: pet.weight_kg ? String(Number(pet.weight_kg)) : '',
    neutered: pet.neutered === null ? 'unknown' : pet.neutered ? 'yes' : 'no',
    temperament: pet.temperament ?? '',
    dietaryNotes: pet.dietary_notes ?? '',
    allergies: pet.allergies ?? '',
    knownConditions: pet.known_conditions ?? '',
    medications: pet.medications ?? '',
    emergencyContactName: pet.emergency_contact_name ?? '',
    emergencyContactPhone: pet.emergency_contact_phone ?? '',
  };
}
