import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { PreparedImage } from './api';

const MAX_DIMENSION = 1280;

/**
 * Let the user pick a photo (Android photo picker: no storage permission needed),
 * square-crop it, then downscale and re-encode as JPEG. Re-encoding also strips
 * EXIF metadata such as GPS location before anything leaves the device.
 */
export async function pickPetPhoto(): Promise<PreparedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;

  const context = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_DIMENSION) {
    context.resize(
      asset.width >= asset.height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION },
    );
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const blob = await (await fetch(saved.uri)).blob();
  return { uri: saved.uri, contentType: 'image/jpeg', blob };
}
