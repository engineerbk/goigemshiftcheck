import { Platform } from 'react-native';
import { getToken } from './api';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';

/**
 * Download a binary file (e.g. xlsx) from a backend path with Bearer auth.
 * Web: Blob download. Native: writes base64 to documentDirectory and shares.
 */
export async function downloadBinary(path: string, suggestedFilename: string, mimeType: string) {
  const token = await getToken();
  const url = `${BASE}/api${path}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const ab = await res.arrayBuffer();

  if (Platform.OS === 'web') {
    const blob = new Blob([ab], { type: mimeType });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href; a.download = suggestedFilename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(href);
    return;
  }

  // Native
  const bytes = new Uint8Array(ab);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  // @ts-ignore - btoa is polyfilled by React Native
  const base64 = (globalThis as any).btoa(binary);

  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const dir = (FileSystem as any).documentDirectory as string;
  const fileUri = `${dir}${suggestedFilename}`;
  await (FileSystem as any).writeAsStringAsync(fileUri, base64, { encoding: 'base64' });
  if (await (Sharing as any).isAvailableAsync()) {
    await (Sharing as any).shareAsync(fileUri, {
      mimeType,
      dialogTitle: suggestedFilename,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
}

/**
 * Download a CSV file from a backend path (with Bearer auth) and trigger save/share.
 *  - Web: triggers a browser download via Blob + temporary anchor.
 *  - Native: writes to documentDirectory and opens the OS share sheet.
 */
export async function downloadCsv(path: string, suggestedFilename: string) {
  const token = await getToken();
  const url = `${BASE}/api${path}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const text = await res.text();

  if (Platform.OS === 'web') {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = suggestedFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
    return;
  }

  // Native (iOS/Android)
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const dir = (FileSystem as any).documentDirectory as string;
  const fileUri = `${dir}${suggestedFilename}`;
  await (FileSystem as any).writeAsStringAsync(fileUri, text, {
    encoding: (FileSystem as any).EncodingType?.UTF8 || 'utf8',
  });
  const can = await (Sharing as any).isAvailableAsync();
  if (can) {
    await (Sharing as any).shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: suggestedFilename,
      UTI: 'public.comma-separated-values-text',
    });
  }
}
