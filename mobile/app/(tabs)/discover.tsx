import { ComingSoon, HeroScreen } from '@/components/ui';

export default function DiscoverScreen() {
  return (
    <HeroScreen
      testID="discover-screen"
      eyebrow="Discover"
      title="Trusted care near you"
      subtitle="Verified vets, clinics and caretakers in Tamil Nadu, Kerala and Bengaluru."
      overlap
    >
      <ComingSoon
        title="We're onboarding providers"
        items={[
          {
            icon: 'shield-checkmark',
            tone: 'sage',
            title: 'Only verified providers',
            subtitle: 'Every vet and clinic is checked by our team before listing.',
          },
          {
            icon: 'location',
            tone: 'lavender',
            title: 'Near you, list or map',
            subtitle: 'Sort by distance, price, rating and availability.',
          },
          {
            icon: 'flash',
            tone: 'coral',
            title: 'Book in a few taps',
            subtitle: 'See real time slots, pick one and you’re done.',
          },
        ]}
      />
    </HeroScreen>
  );
}
