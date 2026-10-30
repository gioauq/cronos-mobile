/**
 * O padrão de foto de rosto que os relógios aceitam. Os mesmos números de
 * App\Support\FacePhotoStandard no servidor (lá é a fonte da verdade; aqui estão repetidos
 * porque o app não tem como ler o PHP) — foram descobertos na prática: foto acima de
 * 900x1600 estourava "Content Error / urlDownloadFail" no terminal.
 *
 * Por que isso importa no app e não só no servidor: o expo-image-picker usa `quality` mas NÃO
 * limita resolução, então a câmera frontal inteira do celular vem junto. Medido em produção em
 * 30/10/2026, a selfie do app chegava com ~1,3 MB — 14x o padrão — e esse 1,3 MB subia pela
 * rede do aparelho, que é onde o tempo de verdade é gasto (no servidor, o PHP levava 30 ms).
 * O servidor enquadra o que chega grande, mas só o app evita a subida.
 *
 * Este arquivo não importa NADA de propósito: é a parte da regra que dá para executar fora do
 * aparelho, sem emulador e sem módulo nativo.
 */
export const FACE_PHOTO_MAX_WIDTH = 900;
export const FACE_PHOTO_MAX_HEIGHT = 1600;

/**
 * O tamanho final da foto, ou null quando ela já está dentro do padrão e não há nada a fazer.
 *
 * Mesma conta do servidor e do portal: reduz na proporção e NUNCA aumenta. Os dois valores são
 * devolvidos de propósito — o resize do expo-image-manipulator só preserva a proporção quando
 * recebe UMA dimensão, e passar as duas já calculadas evita qualquer dúvida sobre qual lado
 * ele usaria como referência.
 */
export function frameSize(
  width: number,
  height: number,
): { width: number; height: number } | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const scale = Math.min(1, FACE_PHOTO_MAX_WIDTH / width, FACE_PHOTO_MAX_HEIGHT / height);

  if (scale >= 1) {
    return null;
  }

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
