import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Slot } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import { createQueryClient } from '@/api';

import BookingsScreen from '../app/(tabs)/bookings';
import CommunityScreen from '../app/(tabs)/community';
import DiscoverScreen from '../app/(tabs)/discover';
import HomeScreen from '../app/(tabs)/index';
import TabsLayout from '../app/(tabs)/_layout';
import PetsScreen from '../app/(tabs)/pets';

function Root() {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <Slot />
    </QueryClientProvider>
  );
}

const routes = {
  _layout: Root,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeScreen,
  '(tabs)/discover': DiscoverScreen,
  '(tabs)/bookings': BookingsScreen,
  '(tabs)/community': CommunityScreen,
  '(tabs)/pets': PetsScreen,
  profile: () => null,
};

describe('tab navigation', () => {
  it('starts on Home and shows all five tabs', async () => {
    await renderRouter(routes, { initialUrl: '/' });

    expect(screen).toHavePathname('/');
    expect(screen.getByTestId('home-screen')).toBeOnTheScreen();
    for (const label of ['Home', 'Discover', 'Bookings', 'Community', 'My Pets']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('Book a vet opens Discover', async () => {
    await renderRouter(routes, { initialUrl: '/' });

    await fireEvent.press(screen.getByRole('button', { name: 'Book a vet' }));

    await waitFor(() => expect(screen).toHavePathname('/discover'));
    expect(await screen.findByTestId('discover-screen')).toBeOnTheScreen();
  });

  it('Bookings empty state links to Discover', async () => {
    await renderRouter(routes, { initialUrl: '/bookings' });

    await fireEvent.press(screen.getByRole('button', { name: 'Explore care' }));

    await waitFor(() => expect(screen).toHavePathname('/discover'));
  });
});
