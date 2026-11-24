import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import { createQueryClient } from '@/api';
import { completeSignIn, resetSessionForTests } from '@/features/auth/session';
import { RootNavigator } from '@/navigation/RootNavigator';

import TabsLayout from '../app/(tabs)/_layout';
import HomeScreen from '../app/(tabs)/index';
import PetsScreen from '../app/(tabs)/pets';
import EditPetScreen from '../app/pets/[id]/edit';
import PetDetailScreen from '../app/pets/[id]/index';
import NewPetScreen from '../app/pets/new';

import { createFakeApi, tokens, USER, type FakeApi } from './helpers/fakeApi';
import { PET } from './helpers/pets';

function Root() {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <RootNavigator />
    </QueryClientProvider>
  );
}

const routes = {
  _layout: Root,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeScreen,
  '(tabs)/pets': PetsScreen,
  'pets/new': NewPetScreen,
  'pets/[id]/index': PetDetailScreen,
  'pets/[id]/edit': EditPetScreen,
};

let api: FakeApi;
let pets: (typeof PET)[];

beforeEach(async () => {
  resetSessionForTests();
  api = createFakeApi();
  globalThis.fetch = api.fetch;
  pets = [];
  api.on('GET', '/pets', () => [200, pets]);
  await completeSignIn({
    ...tokens(1),
    user: { ...USER, display_name: 'Priya' },
    is_new_user: false,
  });
});

describe('My Pets', () => {
  it('adds, views, edits and removes a pet', async () => {
    api.on('POST', '/pets', (body) => {
      const created = { ...PET, ...(body as object), id: PET.id, photo_url: null };
      pets = [created];
      return [201, created];
    });
    api.on('GET', `/pets/${PET.id}`, () => [200, pets[0]]);
    api.on('PATCH', `/pets/${PET.id}`, (body) => {
      pets = [{ ...pets[0]!, ...(body as object) }];
      return [200, pets[0]];
    });
    api.on('DELETE', `/pets/${PET.id}`, () => {
      pets = [];
      return [204, undefined];
    });

    await renderRouter(routes, { initialUrl: '/pets' });

    // Empty state -> add form
    await fireEvent.press(await screen.findByRole('button', { name: 'Add your first pet' }));
    await screen.findByTestId('new-pet-screen');

    // Validation before submit
    await fireEvent.press(screen.getByTestId('pet-form-submit'));
    expect(await screen.findByText("Enter your pet's name.")).toBeOnTheScreen();
    expect(api.calls.some((c) => c.method === 'POST')).toBe(false);

    await fireEvent.changeText(screen.getByTestId('pet-name'), 'Mittens');
    await fireEvent.press(screen.getByTestId('species-cat'));
    await fireEvent.changeText(screen.getByTestId('pet-weightKg'), '4.2');
    await fireEvent.changeText(screen.getByTestId('pet-allergies'), 'Fish');
    await fireEvent.press(screen.getByTestId('pet-form-submit'));

    expect(await screen.findByTestId('pet-detail-screen')).toBeOnTheScreen();
    const post = api.calls.find((c) => c.method === 'POST' && c.path === '/pets');
    expect(post?.body).toMatchObject({
      name: 'Mittens',
      species: 'cat',
      weight_kg: '4.2',
      allergies: 'Fish',
      breed: null,
    });
    expect(screen.getAllByText('Mittens').length).toBeGreaterThan(0);
    expect(screen.getByText('Fish')).toBeOnTheScreen();

    // Edit
    await fireEvent.press(screen.getByTestId('edit-pet'));
    const nameField = await screen.findByTestId('pet-name');
    await fireEvent.changeText(nameField, 'Mittens II');
    await fireEvent.press(screen.getByTestId('pet-form-submit'));
    await waitFor(() => expect(api.calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(api.calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ name: 'Mittens II' });
    expect(await screen.findByTestId('pet-detail-screen')).toBeOnTheScreen();

    // Remove (confirm dialog)
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await fireEvent.press(screen.getByTestId('delete-pet'));
    expect(alert).toHaveBeenCalled();
    await waitFor(() => expect(api.calls.some((c) => c.method === 'DELETE')).toBe(true));
    expect(await screen.findByText('Every pet, one place')).toBeOnTheScreen();
  });

  it('shows an error state with retry when pets fail to load', async () => {
    let fail = true;
    api.on('GET', '/pets', () =>
      fail
        ? [500, { error: { code: 'internal_error', message: 'boom', request_id: 'req-9' } }]
        : [200, [PET]],
    );
    await renderRouter(routes, { initialUrl: '/pets' });

    expect(
      await screen.findByText('Something went wrong', {}, { timeout: 5000 }),
    ).toBeOnTheScreen();
    expect(screen.getByText('Reference: req-9')).toBeOnTheScreen();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId(`pet-card-${PET.id}`)).toBeOnTheScreen();
  });

  it('home shows the pet switcher with the first pet active', async () => {
    pets = [PET, { ...PET, id: 'p2', name: 'Kitty', species: 'cat' }];
    await renderRouter(routes, { initialUrl: '/' });

    const bruno = await screen.findByRole('button', { name: 'Bruno' });
    expect(bruno).toBeSelected();
    await fireEvent.press(screen.getByRole('button', { name: 'Kitty' }));
    expect(screen.getByRole('button', { name: 'Kitty' })).toBeSelected();
    expect(screen.getByRole('button', { name: 'Bruno' })).not.toBeSelected();
  });
});
