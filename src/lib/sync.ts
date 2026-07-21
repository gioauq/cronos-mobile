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
};

export async function trySync(userId: number): Promise<SyncOutcome> {
  if (isSyncing) {
    return { attempted: false, created: 0, alreadySynced: 0, rejected: 0 };
  }

  isSyncing = true;
  try {
    const reachable = await pingServer();
    if (!reachable) {
      return { attempted: false, created: 0, alreadySynced: 0, rejected: 0 };
    }

    const pending = await getPendingRecords(userId);
    if (pending.length === 0) {
      return { attempted: true, created: 0, alreadySynced: 0, rejected: 0 };
    }

    let created = 0;
    let alreadySynced = 0;
    let rejected = 0;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);
      const selfieByHash = new Map(batch.map((r) => [r.hash, r.selfie_uri]));
      const response = await syncTimeRecords(batch);

      for (const result of response.results) {
        if (!result.hash) continue;

        if (result.status === 'created' || result.status === 'already_synced') {
          await markSynced(result.hash);
          deleteSelfie(selfieByHash.get(result.hash) ?? null);
          if (result.status === 'created') created += 1;
          else alreadySynced += 1;
        } else if (result.status === 'rejected') {
          await markRejected(result.hash, result.reason ?? 'desconhecido');
          rejected += 1;
        }
      }
    }

    return { attempted: true, created, alreadySynced, rejected };
  } finally {
    isSyncing = false;
  }
}
