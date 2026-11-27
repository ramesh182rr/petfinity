import { originParams } from '@/features/discovery/api';
import {
  avatarName,
  distanceLabel,
  originLabel,
  slotLabel,
  whereLabel,
} from '@/features/discovery/format';
import type { Listing } from '@/features/discovery/types';

const base: Listing = {
  kind: 'clinic',
  id: 'c',
  name: 'Lotus Pet Clinic',
  subtitle: 'Adyar, Chennai',
  area_name: 'Chennai',
  distance_km: 2.44,
  distance_is_approximate: false,
  service_radius_km: null,
  verified_at: null,
  emergency: false,
  modes: ['in_clinic'],
  categories: [],
  price_from_minor: 50000,
  service_count: 1,
  open_now: false,
  next_slot_at: null,
  languages: [],
  years_experience: null,
  rating: null,
  review_count: 0,
};

describe('discovery formatting', () => {
  it('formats distances, flagging area-centre estimates', () => {
    expect(distanceLabel(0.4)).toBe('<1 km');
    expect(distanceLabel(2.44)).toBe('2.4 km');
    expect(distanceLabel(12.6)).toBe('13 km');
    expect(distanceLabel(0.2, true)).toBe('~1 km');
    expect(distanceLabel(null)).toBeNull();
  });

  it('labels slots relative to today', () => {
    const now = new Date(2026, 10, 26, 10, 0);
    expect(slotLabel(new Date(2026, 10, 26, 16, 30).toISOString(), now)).toBe('Today 4:30 pm');
    expect(slotLabel(new Date(2026, 10, 27, 9, 0).toISOString(), now)).toBe('Tomorrow 9:00 am');
    expect(slotLabel(new Date(2026, 10, 30, 9, 0).toISOString(), now)).toMatch(/^Mon 9:00 am$/);
  });

  it('never shows a distance for home-visit vets', () => {
    expect(whereLabel(base)).toBe('Adyar, Chennai · 2.4 km');
    expect(whereLabel({ ...base, kind: 'vet', distance_km: null, service_radius_km: 15 })).toBe(
      'Chennai · Home visits within 15 km',
    );
  });

  it('builds origin params and labels', () => {
    expect(originParams({ type: 'area', key: 'kochi', name: 'Kochi' })).toEqual({ area: 'kochi' });
    expect(originParams({ type: 'device', latitude: 13.006712, longitude: 80.25751 })).toEqual({
      lat: '13.0067',
      lng: '80.2575',
    });
    expect(originParams(null)).toEqual({});
    expect(originLabel(null)).toBe('Choose area');
    expect(originLabel({ type: 'device', latitude: 1, longitude: 2 })).toBe('Near you');
    expect(avatarName('Dr. Priya Nair')).toBe('Priya Nair');
  });
});
