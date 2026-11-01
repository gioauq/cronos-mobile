import { pingServer } from '../api/client';
import { syncTimeRecords, type UploadableRecord } from '../api/timeRecords';
import { getPendingRecords, markRejected, markSynced, type PendingRecord } from '../db/database';
import { deleteSelfie, resolveSelfieUri } from './selfie';
import {
  BACKGROUND_SYNC_BUDGET_MS,
  isDefinitiveRefusal,
  nextAttemptTimeoutMs,
  planBatches,
} from './syncBatching';

let isSyncing = false;

export type SyncOutcome = {
  attempted: boolean;
  created: number;
  alreadySynced: number;
  rejected: number;
  /** Aceitas pelo servidor mas em quarentena (fora do raio / sem selfie) — ver SyncDivergence. */
  divergent: number;
  /** Motivos das divergentes deste sync, pra avisar o servidor uma vez só. */
  divergenceReasons: string[];
  /** Enviadas sem resposta nenhuma do servidor — continuam na fila. */
  unanswered: number;
  /** Lotes que nem chegaram a ser tentados porque o orçamento de tempo acabou. */
  skippedForTime: number;
};

const EMPTY: SyncOutcome = {
  attempted: false,
  created: 0,
  alreadySynced: 0,
  rejected: 0,
  divergent: 0,
  divergenceReasons: [],
  unanswered: 0,
  skippedForTime: 0,
};

type HttpishError = { response?: { status?: number; data?: { message?: string } } };

function refusalReason(error: unknown): string {
  const response = (error as HttpishError)?.response;

  return response?.data?.message ?? `Recusado pelo servidor (HTTP ${response?.status ?? '?'}).`;
}

/**
 * Sobe a fila de marcações pendentes.
 *
 * Três garantias que o desenho antigo não dava, e que eram a causa de a fila travar para sempre
 * (ver o cabeçalho de ./syncBatching.ts para os números medidos em produção):
 *
 * 1. Lote pequeno e timeout proporcional ao que ele carrega. Antes eram 50 marcações com as
 *    selfies no mesmo POST contra 10 segundos — não cabia em rede nenhuma de celular.
 * 2. Um lote que falha NÃO leva os outros junto: cada um tem o seu try/catch e o laço segue.
 *    Antes, a primeira falha abortava o envio inteiro sem marcar nada.
 * 3. Recusa definitiva do servidor (403, 422) tira a marcação da fila e a deixa visível como
 *    pendência no histórico, com motivo. Antes, ela voltava para sempre e o contador só subia.
 *
 * `budgetMs` é o teto de tempo do envio INTEIRO, porque a tela de ponto espera por ele antes de
 * gravar a batida nova (ver HomeScreen): no toque ele é curto, no fundo é longo. O que não couber
 * continua pendente para a próxima rodada.
 */
export async function trySync(userId: number, budgetMs: number = BACKGROUND_SYNC_BUDGET_MS): Promise<SyncOutcome> {
  if (isSyncing) return { ...EMPTY };

  isSyncing = true;
  const startedAt = Date.now();

  try {
    const reachable = await pingServer();
    if (!reachable) return { ...EMPTY };

    const pending = await getPendingRecords(userId);
    if (pending.length === 0) return { ...EMPTY, attempted: true };

    const outcome: SyncOutcome = { ...EMPTY, attempted: true, divergenceReasons: [] };

    for (const batch of planBatches(pending)) {
      const timeoutMs = nextAttemptTimeoutMs(batch, Date.now() - startedAt, budgetMs);

      // Orçamento no fim: o que sobrou fica pendente e sobe na próxima rodada. Melhor do que
      // começar uma requisição que já nasce sem tempo de terminar.
      if (timeoutMs === null) {
        outcome.skippedForTime += 1;
        continue;
      }

      await sendBatch(batch, timeoutMs, outcome);
    }

    return outcome;
  } finally {
    isSyncing = false;
  }
}

async function sendBatch(batch: PendingRecord[], timeoutMs: number, outcome: SyncOutcome): Promise<void> {
  // A selfie é reencontrada pelo NOME agora, não pelo caminho gravado na fila: no iOS o caminho
  // absoluto quebra quando o app é atualizado. Sumiu o arquivo, a marcação sobe sem foto e o
  // servidor a guarda em quarentena — hora registrada com pendência é melhor que hora perdida.
  const uploadable: UploadableRecord[] = batch.map((record) => ({
    ...record,
    selfie_uri: resolveSelfieUri(record.selfie_uri),
  }));

  let response;
  try {
    response = await syncTimeRecords(uploadable, timeoutMs);
  } catch (error) {
    if (!isDefinitiveRefusal((error as HttpishError)?.response?.status)) {
      // Sem rede, timeout, 401 ou servidor fora: continuam pendentes para a próxima tentativa.
      outcome.unanswered += batch.length;

      return;
    }

    const reason = refusalReason(error);
    for (const record of batch) {
      await markRejected(record.hash, reason);
      outcome.rejected += 1;
    }

    return;
  }

  const answered = new Set<string>();

  for (const result of response.results) {
    if (!result.hash) continue;
    answered.add(result.hash);

    if (result.status === 'created' || result.status === 'already_synced') {
      // A divergente também sai da fila: ela ESTÁ no servidor, só esperando liberação.
      // Deixá-la pendente faria o app reenviar pra sempre a mesma batida.
      await markSynced(result.hash);
      deleteSelfie(batch.find((record) => record.hash === result.hash)?.selfie_uri ?? null);

      if (result.status === 'created') outcome.created += 1;
      else outcome.alreadySynced += 1;

      if (result.divergence) {
        outcome.divergent += 1;
        result.divergence.reasons.forEach((reason) => {
          if (!outcome.divergenceReasons.includes(reason)) outcome.divergenceReasons.push(reason);
        });
      }
    } else if (result.status === 'rejected') {
      await markRejected(result.hash, result.reason ?? 'desconhecido');
      outcome.rejected += 1;
    }
  }

  // Mandei 3 e o servidor respondeu sobre 2: a terceira continua pendente. Antes isso era
  // invisível; agora pelo menos sai contado no resultado do envio.
  outcome.unanswered += batch.filter((record) => !answered.has(record.hash)).length;
}
