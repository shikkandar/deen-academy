import * as ImagePicker from 'expo-image-picker';

import type { Masjid, MasjidPrayer, MasjidTime } from './settings';

// The Go backend (backend/cmd/api). In development this is the Mac's LAN address — see mobile/.env.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const APP_KEY = process.env.EXPO_PUBLIC_APP_KEY;

type ScanResponse = Record<MasjidPrayer, MasjidTime> & {
  masjidName: string | null;
  notes: string | null;
};

export type ScanResult = { name: string | null; times: Masjid['times']; notes: string | null };

/** Opens the camera (or gallery) for a photo of the timing board. Returns null if she cancels. */
export async function pickBoardPhoto(source: 'camera' | 'gallery') {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 0.6 };
  if (source === 'camera') {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) throw new Error('Camera permission is needed to scan the board.');
  }
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0];
}

/** Sends the photo to the backend, which reads the times with Claude. */
export async function scanBoard(photo: ImagePicker.ImagePickerAsset): Promise<ScanResult> {
  const form = new FormData();
  // React Native's FormData takes a { uri, name, type } file descriptor.
  form.append('image', {
    uri: photo.uri,
    name: photo.fileName ?? 'board.jpg',
    type: photo.mimeType ?? 'image/jpeg',
  } as unknown as Blob);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/masjid/scan`, {
      method: 'POST',
      body: form,
      headers: APP_KEY ? { 'X-App-Key': APP_KEY } : undefined,
    });
  } catch {
    throw new Error("Couldn't reach the server. Check the internet connection and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? 'Scan failed, please try again.');

  const data = body as ScanResponse;
  return {
    name: data.masjidName,
    notes: data.notes,
    times: {
      fajr: data.fajr,
      dhuhr: data.dhuhr,
      asr: data.asr,
      maghrib: data.maghrib,
      isha: data.isha,
      jummah: data.jummah,
    },
  };
}
