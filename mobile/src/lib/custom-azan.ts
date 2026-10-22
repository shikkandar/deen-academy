import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';

// An Azan recording picked from the phone: copied into the app's own folder so it keeps playing even if
// the original is moved or deleted. Nothing is uploaded or shipped with the app.

export type AzanLength = 'full' | 'short';

/** Lets her pick an audio file; returns where the app's copy is kept, or null if she cancelled. */
export async function pickAzanFile(length: AzanLength): Promise<{ uri: string; name: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['audio/*', 'video/mp4'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const dir = new Directory(Paths.document, 'azan');
  if (!dir.exists) dir.create();
  const ext = (asset.name.split('.').pop() || 'mp3').toLowerCase();
  const dest = new File(dir, `custom-${length}-${Date.now()}.${ext}`);
  new File(asset.uri).copy(dest);
  return { uri: dest.uri, name: asset.name };
}

/** Forget a picked file (back to the built-in Azan). */
export function deleteAzanFile(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // already gone
  }
}
