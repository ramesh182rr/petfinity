import { resolveMediaUrl } from '@/api/urls';
import { ageLabel, petSubtitle, speciesLabel, toIsoDate } from '@/features/pets/format';
import { petFormSchema, toFormValues, toPetPayload, emptyPetForm } from '@/features/pets/schema';

import { PET } from './helpers/pets';

const today = new Date('2026-11-25T12:00:00');

describe('pet formatting', () => {
  it.each([
    ['2023-11-25', false, '3 yrs'],
    ['2025-11-24', false, '1 yr'],
    ['2026-04-10', true, '~7 mos'],
    ['2026-10-20', false, '1 mo'],
    ['2026-11-11', false, '2 wks'],
  ])('age for %s (estimate=%s) is %s', (dob, estimate, expected) => {
    expect(ageLabel({ date_of_birth: dob, date_of_birth_is_estimate: estimate }, today)).toBe(
      expected,
    );
  });

  it('labels species, using the custom name for "other"', () => {
    expect(speciesLabel({ species: 'guinea_pig', species_other: null })).toBe('Guinea pig');
    expect(speciesLabel({ species: 'other', species_other: 'Hedgehog' })).toBe('Hedgehog');
    expect(petSubtitle({ ...PET, breed: 'Indie', date_of_birth: null })).toBe('Dog · Indie');
  });

  it('formats dates for the API in local time', () => {
    expect(toIsoDate(new Date(2024, 0, 5))).toBe('2024-01-05');
  });

  it('resolves local-storage URLs against the API and keeps absolute URLs', () => {
    expect(resolveMediaUrl('/api/v1/dev-storage/pets/a.jpg?sig=1', 'http://10.0.2.2:8000')).toBe(
      'http://10.0.2.2:8000/api/v1/dev-storage/pets/a.jpg?sig=1',
    );
    expect(resolveMediaUrl('https://acct.r2.cloudflarestorage.com/x?X-Amz=1')).toBe(
      'https://acct.r2.cloudflarestorage.com/x?X-Amz=1',
    );
    expect(resolveMediaUrl(null)).toBeNull();
  });
});

describe('pet form conversion', () => {
  it('turns form values into an API payload, clearing blanks', () => {
    const values = petFormSchema.parse({
      ...emptyPetForm,
      name: ' Kitty ',
      species: 'cat',
      speciesOther: 'ignored',
      weightKg: '4.5',
      neutered: 'yes',
      allergies: '  ',
      emergencyContactPhone: '98765 43210',
      dateOfBirth: new Date(2022, 2, 1),
      dateOfBirthIsEstimate: true,
    });
    expect(toPetPayload(values)).toMatchObject({
      name: 'Kitty',
      species: 'cat',
      species_other: null,
      weight_kg: '4.5',
      neutered: true,
      allergies: null,
      emergency_contact_phone: '+919876543210',
      date_of_birth: '2022-03-01',
      date_of_birth_is_estimate: true,
    });
  });

  it('round-trips an existing pet through the form', () => {
    const pet = {
      ...PET,
      neutered: false,
      weight_kg: '12.50',
      species: 'other' as const,
      species_other: 'Ferret',
    };
    const payload = toPetPayload(petFormSchema.parse(toFormValues(pet)));
    expect(payload).toMatchObject({
      neutered: false,
      weight_kg: '12.5',
      species: 'other',
      species_other: 'Ferret',
    });
  });

  it.each([
    [{ name: '' }, 'name'],
    [{ species: 'other' as const, speciesOther: '' }, 'speciesOther'],
    [{ weightKg: '0' }, 'weightKg'],
    [{ weightKg: '12.555' }, 'weightKg'],
    [{ emergencyContactPhone: '123' }, 'emergencyContactPhone'],
    [{ dateOfBirth: new Date(2999, 0, 1) }, 'dateOfBirth'],
  ])('rejects %o', (override, field) => {
    const result = petFormSchema.safeParse({ ...emptyPetForm, name: 'Bruno', ...override });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toContain(field);
  });
});
