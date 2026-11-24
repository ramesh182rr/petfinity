import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { resolveMediaUrl } from '@/api/urls';
import { IconBadge } from '@/components/ui';
import { colors } from '@/theme';

import { speciesIcon } from './format';
import type { Pet } from './types';

type Props = { pet: Pick<Pet, 'photo_url' | 'species' | 'name'>; size?: number };

/** Round pet photo with a species icon fallback (also used if the signed URL expired). */
export function PetAvatar({ pet, size = 56 }: Props) {
  const [failed, setFailed] = useState(false);
  const uri = resolveMediaUrl(pet.photo_url);
  const icon = speciesIcon(pet.species);

  if (!uri || failed) {
    return (
      <View style={{ width: size, height: size }} accessibilityLabel={`${pet.name}, no photo`}>
        <IconBadge name={icon.name} tone={icon.tone} size={size >= 72 ? 'lg' : 'md'} />
      </View>
    );
  }
  return (
    <Image
      // Signed URLs change on every fetch; cache by the object path instead.
      source={{ uri, cacheKey: uri.split('?')[0] }}
      onError={() => setFailed(true)}
      accessibilityLabel={`Photo of ${pet.name}`}
      contentFit="cover"
      transition={150}
      style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
    />
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.primaryTint },
});
