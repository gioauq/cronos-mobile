import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';

/**
 * Abre a câmera frontal para o funcionário tirar a selfie da marcação de ponto.
 * Retorna null se o funcionário cancelar ou a permissão for negada — nesses casos
 * o ponto não deve ser registrado, já que a selfie é obrigatória.
 */
export async function captureSelfie(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    cameraType: ImagePicker.CameraType.front,
    mediaTypes: ['images'],
    quality: 0.5,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const source = new File(result.assets[0].uri);
  const destination = new File(Paths.document, `selfie_${Date.now()}_${Math.round(Math.random() * 1e6)}.jpg`);

  await source.copy(destination);

  return destination.uri;
}

export function deleteSelfie(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // Arquivo já pode ter sido removido — não é crítico.
  }
}
