import { toClinicPayload } from '@/features/providers/ClinicForm';
import { toProfilePayload } from '@/features/providers/ProviderProfileForm';

const base = {
  displayName: ' Dr. Priya Nair ',
  bio: '',
  yearsExperience: '8',
  languages: ['Tamil', 'English'],
  city: 'Chennai',
  registrationNumber: ' TNSVC/1234 ',
  registrationCouncil: 'Tamil Nadu State Veterinary Council',
  qualifications: '',
  areaKey: 'chennai',
  latitude: '13.040000',
  longitude: '80.230000',
  serviceRadiusKm: 15,
};

describe('provider profile payload', () => {
  it('includes registration fields for vets and cleans blanks', () => {
    expect(toProfilePayload(base, 'veterinarian')).toEqual({
      display_name: 'Dr. Priya Nair',
      bio: null,
      years_experience: 8,
      languages: ['Tamil', 'English'],
      city: 'Chennai',
      registration_number: 'TNSVC/1234',
      registration_council: 'Tamil Nadu State Veterinary Council',
      qualifications: null,
      area_key: 'chennai',
      latitude: '13.040000',
      longitude: '80.230000',
      service_radius_km: 15,
    });
  });

  it('omits registration fields for caretakers', () => {
    const payload = toProfilePayload({ ...base, yearsExperience: '' }, 'caretaker');
    expect(payload).not.toHaveProperty('registration_number');
    expect(payload).not.toHaveProperty('service_radius_km');
    expect(payload.years_experience).toBeNull();
  });
});

describe('clinic payload', () => {
  const values = {
    name: 'Paws & Care Clinic',
    phone: '044 2345 6789',
    email: '',
    addressLine1: '12, Lake View Road',
    addressLine2: '',
    locality: 'Adyar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    postalCode: '600020',
    emergencyServices: true,
    practisesHere: true,
    areaKey: 'chennai',
    latitude: null,
    longitude: null,
  };

  it('normalises landlines and only sends practises_here when offered', () => {
    expect(toClinicPayload(values, true)).toMatchObject({
      phone: '+914423456789',
      email: null,
      address_line2: null,
      practises_here: true,
      emergency_services: true,
      area_key: 'chennai',
      latitude: null,
    });
    expect(toClinicPayload(values, false).practises_here).toBe(false);
  });
});
