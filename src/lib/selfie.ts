import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';

import { frameSize } from './facePhotoStandard';

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

  const asset = result.assets[0];
  const source = new File(await frameToStandard(asset.uri, asset.width, asset.height));
  const destination = new File(Paths.document, `selfie_${Date.now()}_${Math.round(Math.random() * 1e6)}.jpg`);

  await source.copy(destination);

  return destination.uri;
}

/**
 * Enquadra a foto no padrão do relógio (ver ./facePhotoStandard) antes de ela ir para a fila
 * de envio. Devolve a URI da foto enquadrada, ou a original quando não havia o que enquadrar.
 *
 * Se o redimensionamento falhar (erro nativo, formato inesperado), segue com a foto ORIGINAL:
 * uma selfie grande é muito melhor que uma marcação de ponto perdida. O servidor enquadra
 * depois, ao guardar (ver SelfiePathBuilder).
 */
async function frameToStandard(uri: string, width: number, height: number): Promise<string> {
  const size = frameSize(width, height);

  if (!size) return uri;

  try {
    const rendered = await ImageManipulator.manipulate(uri).resize(size).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });

    return saved.uri;
  } catch {
    return uri;
  }
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
