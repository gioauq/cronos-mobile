import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  let deviceId = await SecureStore.getItemAsync('device_id');
  if (!deviceId) {
    deviceId = Crypto.randomUUID();
    await SecureStore.setItemAsync('device_id', deviceId);
  }

  cachedDeviceId = deviceId;
  return deviceId;
}
