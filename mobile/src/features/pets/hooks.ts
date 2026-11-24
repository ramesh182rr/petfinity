import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import * as petsApi from './api';
import type { Pet, PetCreate, PetUpdate } from './types';

export const petKeys = {
  all: ['pets'] as const,
  detail: (id: string) => ['pets', id] as const,
};

export function usePets() {
  return useQuery({ queryKey: petKeys.all, queryFn: petsApi.listPets });
}

export function usePet(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: petKeys.detail(id),
    queryFn: () => petsApi.getPet(id),
    // Show the list's copy instantly while refetching.
    initialData: () => queryClient.getQueryData<Pet[]>(petKeys.all)?.find((p) => p.id === id),
  });
}

function useSyncPet() {
  const queryClient = useQueryClient();
  return (pet: Pet) => {
    queryClient.setQueryData(petKeys.detail(pet.id), pet);
    queryClient.setQueryData<Pet[]>(petKeys.all, (list) =>
      list
        ? list.some((p) => p.id === pet.id)
          ? list.map((p) => (p.id === pet.id ? pet : p))
          : [...list, pet]
        : list,
    );
  };
}

export function useCreatePet() {
  const sync = useSyncPet();
  return useMutation({ mutationFn: (body: PetCreate) => petsApi.createPet(body), onSuccess: sync });
}

export function useUpdatePet(id: string) {
  const sync = useSyncPet();
  return useMutation({
    mutationFn: (body: PetUpdate) => petsApi.updatePet(id, body),
    onSuccess: sync,
  });
}

export function useDeletePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => petsApi.deletePet(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<Pet[]>(petKeys.all, (list) => list?.filter((p) => p.id !== id));
      queryClient.removeQueries({ queryKey: petKeys.detail(id) });
    },
  });
}

export function useUploadPetPhoto(id: string) {
  const sync = useSyncPet();
  return useMutation({
    mutationFn: (image: petsApi.PreparedImage) => petsApi.uploadPetPhoto(id, image),
    onSuccess: sync,
  });
}

export function useRemovePetPhoto(id: string) {
  const sync = useSyncPet();
  return useMutation({ mutationFn: () => petsApi.removePetPhoto(id), onSuccess: sync });
}
