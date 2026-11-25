import { ComingSoon, HeroScreen } from '@/components/ui';

export default function CommunityScreen() {
  return (
    <HeroScreen
      testID="community-screen"
      eyebrow="Community"
      title="Your local pet family"
      subtitle="Share moments, ask questions and meet pet parents nearby."
      gradient="dusk"
      overlap
    >
      <ComingSoon
        title="A friendly, moderated space"
        items={[
          {
            icon: 'images',
            tone: 'coral',
            title: 'Share moments',
            subtitle: 'Photos and stories of your pets.',
          },
          {
            icon: 'chatbubbles',
            tone: 'lavender',
            title: 'Ask locals',
            subtitle: 'Advice from pet parents in your area.',
          },
          {
            icon: 'heart',
            tone: 'sage',
            title: 'Safe by design',
            subtitle: 'Report, block and moderation built in.',
          },
        ]}
      />
    </HeroScreen>
  );
}
