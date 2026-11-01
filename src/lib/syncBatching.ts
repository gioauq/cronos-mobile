/**
 * Como a fila de marcações é partida em requisições, quanto tempo cada uma pode levar e quanto
 * tempo o envio inteiro pode levar.
 *
 * Por que isto existe separado: era AQUI que o app travava. A fila subia em lotes de 50
 * marcações com a selfie de cada uma dentro do MESMO POST, contra o timeout de 10s do cliente
 * HTTP. Medida em produção em 30/10/2026, a selfie saía do aparelho com ~1,3 MB (ver
 * ./facePhotoStandard) — 50 delas são ~65 MB, que precisariam de 52 Mbit/s de upload sustentado
 * para caber em 10 segundos. Não cabia nunca. O upload estourava, o erro era engolido, NENHUMA
 * marcação era marcada como enviada, e a tentativa seguinte remontava o mesmo lote.
 *
 * O efeito em produção, medido em 31/10/2026: só 21 batidas de 5 pessoas chegaram ao servidor, e
 * quatro dessas pessoas pararam de aparecer depois de 2 a 4 marcações — o ponto em que a fila
 * delas passou do que cabia em 10s. Como a tela de ponto esvazia a fila antes de gravar a batida
 * nova, cada ponto novo entrava na fila travada e o contador só subia.
 *
 * Este arquivo não importa NADA de propósito, pelo mesmo motivo de ./facePhotoStandard: é a parte
 * da regra que dá para executar fora do aparelho, sem emulador e sem módulo nativo. Ver
 * ./syncBatching.test.ts.
 */

/**
 * Selfies por requisição. Três porque é o que mantém o POST abaixo de ~4 MB no pior caso (a
 * selfie de 1,3 MB dos aparelhos que ainda não receberam o enquadramento) e abaixo de ~1 MB
 * depois que o enquadramento chegar. Lote que não sobe é pior que lote pequeno: ele não sobe
 * NUNCA, e leva o resto da fila junto.
 */
export const MAX_SELFIES_PER_BATCH = 3;

/**
 * Marcações por requisição, contando as que não têm selfie (quarentena por falta de foto, ou
 * batida de quem não precisa de selfie). Sem foto o corpo é texto puro e cabe muito mais, mas um
 * teto evita um POST gigante depois de semanas offline.
 */
export const MAX_RECORDS_PER_BATCH = 25;

/** Tempo mínimo de rede para um lote pequeno, já contando o handshake e a resposta do servidor. */
export const UPLOAD_BASE_MS = 20_000;

/** Quanto cada selfie acrescenta ao teto. ~1,3 MB em rede ruim de celular passa de 20s sozinho. */
export const UPLOAD_PER_SELFIE_MS = 30_000;

/** Teto absoluto de uma requisição: acima disso é melhor desistir e tentar de novo depois. */
export const UPLOAD_MAX_MS = 120_000;

/**
 * Orçamento do envio disparado NO TOQUE de bater ponto. A gravação da batida nova espera por ele
 * (ver HomeScreen e o commit 97996d0: o servidor corrige o tipo lendo a marcação anterior, então
 * uma entrada presa precisa chegar antes da saída nova), então ele tem que ser curto — ninguém
 * pode ficar com o celular na mão esperando a fila de duas semanas subir para bater o ponto.
 * O que não couber aqui continua pendente e sobe no envio de fundo.
 */
export const PUNCH_FLUSH_BUDGET_MS = 8_000;

/**
 * Orçamento do botão "Reenviar" do histórico. Fica no meio: a pessoa pediu de propósito e está
 * olhando o spinner, então vale esperar mais que no toque do ponto — mas não os dois minutos e
 * meio do envio de fundo, que roda sem ninguém esperando.
 */
export const MANUAL_RETRY_BUDGET_MS = 60_000;

/** Orçamento do envio de fundo (intervalo, volta da rede, app voltando ao primeiro plano). */
export const BACKGROUND_SYNC_BUDGET_MS = 150_000;

/**
 * Sobrando menos que isto, não vale começar outro lote: a requisição nasceria com um timeout tão
 * curto que falharia por tempo mesmo com a rede boa — e lote que falha não marca nada.
 */
export const MIN_ATTEMPT_MS = 5_000;

type HasSelfie = { selfie_uri: string | null };

/**
 * Parte a fila em requisições, PRESERVANDO A ORDEM. A ordem importa: o servidor corrige o tipo da
 * batida (entrada/saída) lendo a anterior já gravada, então a fila precisa chegar na sequência em
 * que foi batida.
 */
export function planBatches<T extends HasSelfie>(records: readonly T[]): T[][] {
  const batches: T[][] = [];
  let current: T[] = [];
  let selfies = 0;

  for (const record of records) {
    const hasSelfie = Boolean(record.selfie_uri);
    const full = current.length >= MAX_RECORDS_PER_BATCH || (hasSelfie && selfies >= MAX_SELFIES_PER_BATCH);

    if (current.length > 0 && full) {
      batches.push(current);
      current = [];
      selfies = 0;
    }

    current.push(record);
    if (hasSelfie) selfies += 1;
  }

  if (current.length > 0) batches.push(current);

  return batches;
}

/** O teto de tempo de UMA requisição, proporcional ao que ela carrega. */
export function uploadTimeoutMs(records: readonly HasSelfie[]): number {
  const selfies = records.filter((record) => Boolean(record.selfie_uri)).length;

  return Math.min(UPLOAD_MAX_MS, UPLOAD_BASE_MS + selfies * UPLOAD_PER_SELFIE_MS);
}

/**
 * Quanto tempo um lote pode usar agora: o teto dele, limitado pelo que sobra do orçamento.
 * Devolve null quando não sobra o suficiente para valer a tentativa.
 */
export function nextAttemptTimeoutMs(
  records: readonly HasSelfie[],
  elapsedMs: number,
  budgetMs: number,
): number | null {
  const remaining = budgetMs - elapsedMs;

  if (remaining < MIN_ATTEMPT_MS) return null;

  return Math.min(uploadTimeoutMs(records), remaining);
}

/**
 * O nome do arquivo da selfie, a partir do que está gravado no banco local.
 *
 * Por que não usar o caminho gravado direto: no iOS o caminho absoluto da selfie fica dentro do
 * contêiner do app, cujo UUID MUDA quando o app é atualizado ou restaurado de backup. A
 * marcação que ficou na fila antes de uma atualização passa a apontar para um arquivo que não
 * existe mais, o corpo multipart não consegue ser montado, e aquela marcação nunca sobe — por
 * mais que o app tente. Resolvendo pelo NOME, o arquivo é reencontrado no contêiner atual. No
 * Android o caminho é estável e isto não muda nada.
 */
export function selfieFileName(storedUri: string | null): string | null {
  if (!storedUri) return null;

  const withoutQuery = storedUri.split('?')[0].split('#')[0];
  const name = withoutQuery.split('/').pop();

  return name && name.length > 0 ? name : null;
}

/**
 * Esta resposta do servidor é uma recusa DEFINITIVA daquele conteúdo, ou vale tentar de novo?
 *
 * Definitiva (o conteúdo nunca vai ser aceito como está): 403 de quem não pode mais bater ponto
 * pelo app, 422 de payload inválido. Essas marcações precisam SAIR da fila e virar pendência
 * visível na tela de histórico — foi um 422 assim, em 25/10/2026, que deixou 26 marcações presas
 * para sempre em produção quando o servidor ainda exigia localização e selfie.
 *
 * Não definitiva: sem rede, timeout (408), excesso de requisições (429), erro do servidor (5xx) e
 * 401 — no 401 o token expirou, e depois de entrar de novo a mesma marcação sobe normalmente.
 */
export function isDefinitiveRefusal(status: number | undefined): boolean {
  if (status === undefined) return false;
  if (status === 401 || status === 408 || status === 429) return false;

  return status >= 400 && status < 500;
}
