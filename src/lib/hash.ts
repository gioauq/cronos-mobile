import * as Crypto from 'expo-crypto';
import { getDeviceId } from './deviceId';

/**
 * Hash determinístico por marcação: mesmo (usuário, dispositivo, tipo, horário)
 * sempre gera o mesmo hash, o que garante idempotência em reenvios de sync.
 * Nunca usar um UUID aleatório aqui — isso quebraria a deduplicação no backend.
 */
export async function generatePunchHash(userId: number, type: string, recordedAtISO: string): Promise<string> {
  const deviceId = await getDeviceId();
  const raw = `${userId}|${deviceId}|${type}|${recordedAtISO}`;
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
}
