import * as DocumentPicker from 'expo-document-picker';

import type { PickedFile } from './api';

export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
export const MAX_DOCUMENT_BYTES = 10_000_000;

export class DocumentPickError extends Error {
  override name = 'DocumentPickError';
}

/** Pick a PDF or photo of a document from files or the gallery. Returns null if cancelled. */
export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ACCEPTED_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  const contentType = asset.mimeType === 'image/jpg' ? 'image/jpeg' : asset.mimeType;
  if (!contentType || !ACCEPTED_TYPES.includes(contentType)) {
    throw new DocumentPickError('Please choose a PDF, JPEG, PNG or WebP file.');
  }
  const blob = await (await fetch(asset.uri)).blob();
  if (blob.size > MAX_DOCUMENT_BYTES) {
    throw new DocumentPickError('That file is larger than 10 MB. Please choose a smaller one.');
  }
  return { uri: asset.uri, name: asset.name, contentType, blob };
}
