import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

import type { IconBadgeTone } from '@/components/ui';

import type { CareType, ReadinessItem } from './types';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const CARE_TYPES: {
  value: CareType;
  label: string;
  where: string;
  unit: 'visit' | 'day' | 'night';
  icon: IconName;
  tone: IconBadgeTone;
}[] = [
  {
    value: 'home_visit',
    label: 'Home visits',
    where: 'Drop-ins at the pet parent’s home: feeding, walks, medicines',
    unit: 'visit',
    icon: 'walk',
    tone: 'sage',
  },
  {
    value: 'day_care',
    label: 'Day care',
    where: 'Pets spend the day at your home',
    unit: 'day',
    icon: 'sunny',
    tone: 'peach',
  },
  {
    value: 'boarding',
    label: 'Boarding',
    where: 'Overnight stays at your home',
    unit: 'night',
    icon: 'moon',
    tone: 'lavender',
  },
  {
    value: 'house_sitting',
    label: 'House sitting',
    where: 'You stay at the pet parent’s home',
    unit: 'night',
    icon: 'home',
    tone: 'coral',
  },
];

export const CARE_LABEL = Object.fromEntries(CARE_TYPES.map((t) => [t.value, t])) as Record<
  CareType,
  (typeof CARE_TYPES)[number]
>;

export const AT_CARETAKER_HOME: CareType[] = ['day_care', 'boarding'];

export const READINESS: Record<ReadinessItem, { title: string; hint: string; icon: IconName }> = {
  services: {
    title: 'Choose your services',
    hint: 'Pick the care you offer and set a starting rate.',
    icon: 'pricetags',
  },
  service_area: {
    title: 'Set where you work',
    hint: 'Your area and how far you travel. Your pin stays private.',
    icon: 'location',
  },
  home_details: {
    title: 'Describe your home',
    hint: 'Needed for day care and boarding.',
    icon: 'home',
  },
  capacity: {
    title: 'Set how many bookings at once',
    hint: 'So you’re never booked beyond what you can handle.',
    icon: 'people',
  },
  verification: {
    title: 'Get verified',
    hint: 'Identity and address proof, checked by Petfinity.',
    icon: 'shield-checkmark',
  },
};

export const SPECIES_LABEL: Record<string, string> = {
  dog: 'Dogs',
  cat: 'Cats',
  other: 'Other pets',
};
