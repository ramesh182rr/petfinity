import { completeSignIn, resetSessionForTests } from '@/features/auth/session';
import { uploadPetPhoto } from '@/features/pets/api';

import { createFakeApi, tokens, USER, type FakeApi } from './helpers/fakeApi';
import { PET } from './helpers/pets';

let api: FakeApi;

beforeEach(async () => {
  resetSessionForTests();
  api = createFakeApi();
  globalThis.fetch = api.fetch;
  await completeSignIn({
    ...tokens(1),
    user: { ...USER, display_name: 'Priya' },
    is_new_user: false,
  });
});

const image = {
  uri: 'file:///photo.jpg',
  contentType: 'image/jpeg' as const,
  blob: { size: 1234 } as Blob,
};

it('requests a signed URL, uploads directly to storage, then confirms', async () => {
  api.on('POST', `/pets/${PET.id}/photo/upload-url`, (body) => [
    201,
    {
      media_id: 'm-1',
      upload: {
        url: '/api/v1/dev-storage/pets/x.jpg?sig=abc',
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
      },
      expires_at: '2026-11-25T10:10:00Z',
    },
  ]);
  api.on('PUT', `/pets/${PET.id}/photo`, () => [
    200,
    { ...PET, photo_url: '/api/v1/dev-storage/pets/x.jpg?sig=get' },
  ]);
  const storagePut = jest.fn().mockResolvedValue(new Response(null, { status: 204 }));

  const pet = await uploadPetPhoto(PET.id, image, storagePut);

  expect(api.calls[0]?.body).toEqual({ content_type: 'image/jpeg', size_bytes: 1234 });
  const [url, init] = storagePut.mock.calls[0];
  expect(url).toMatch(
    /^http:\/\/(localhost|10\.0\.2\.2):8000\/api\/v1\/dev-storage\/pets\/x\.jpg\?sig=abc$/,
  );
  expect(init).toMatchObject({
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: image.blob,
  });
  expect(init.headers.Authorization).toBeUndefined(); // storage never receives API tokens
  expect(api.calls[1]?.body).toEqual({ media_id: 'm-1' });
  expect(pet.photo_url).toContain('sig=get');
});

it('stops if the storage upload fails', async () => {
  api.on('POST', `/pets/${PET.id}/photo/upload-url`, () => [
    201,
    {
      media_id: 'm-1',
      upload: { url: 'https://r2.example/x', method: 'PUT', headers: {} },
      expires_at: 'x',
    },
  ]);
  const storagePut = jest.fn().mockResolvedValue(new Response(null, { status: 403 }));

  await expect(uploadPetPhoto(PET.id, image, storagePut)).rejects.toThrow('Upload failed (403)');
  expect(api.calls.some((c) => c.method === 'PUT')).toBe(false);
});
