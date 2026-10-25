import { pingServer } from '../api/client';
import { syncTimeRecords } from '../api/timeRecords';
import { getPendingRecords, markRejected, markSynced } from '../db/database';
import { deleteSelfie } from './selfie';

const BATCH_SIZE = 50;

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
};

export async function trySync(userId: number): Promise<SyncOutcome> {
  if (isSyncing) {
    return { attempted: false, created: 0, alreadySynced: 0, rejected: 0, divergent: 0, divergenceReasons: [] };
  }

  isSyncing = true;
  try {
    const reachable = await pingServer();
    if (!reachable) {
      return { attempted: false, created: 0, alreadySynced: 0, rejected: 0, divergent: 0, divergenceReasons: [] };
    }

    const pending = await getPendingRecords(userId);
    if (pending.length === 0) {
      return { attempted: true, created: 0, alreadySynced: 0, rejected: 0, divergent: 0, divergenceReasons: [] };
    }

    let created = 0;
    let alreadySynced = 0;
    let rejected = 0;
    let divergent = 0;
    const divergenceReasons: string[] = [];

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const selfieByHash = new Map(batch.map((r) => [r.hash, r.selfie_uri]));
      const response = await syncTimeRecords(batch);

      for (const result of response.results) {
        if (!result.hash) continue;

        if (result.status === 'created' || result.status === 'already_synced') {
          // A divergente também sai da fila: ela ESTÁ no servidor, só esperando liberação.
          // Deixá-la pendente faria o app reenviar pra sempre a mesma batida.
          await markSynced(result.hash);
          deleteSelfie(selfieByHash.get(result.hash) ?? null);
          if (result.status === 'created') created += 1;
          else alreadySynced += 1;

          if (result.divergence) {
            divergent += 1;
            result.divergence.reasons.forEach((reason) => {
              if (!divergenceReasons.includes(reason)) divergenceReasons.push(reason);
            });
          }
        } else if (result.status === 'rejected') {
          await markRejected(result.hash, result.reason ?? 'desconhecido');
          rejected += 1;
        }
      }
    }

    return { attempted: true, created, alreadySynced, rejected, divergent, divergenceReasons };
  } finally {
    isSyncing = false;
  }
}
