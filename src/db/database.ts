import * as SQLite from 'expo-sqlite';

export type PunchType = 'entrada' | 'saida' | 'pausa_entrada' | 'pausa_saida';

export const SYNC_PENDING = 0;
export const SYNC_SYNCED = 1;
export const SYNC_REJECTED = 2;

export type PendingRecord = {
  id: number;
  hash: string;
  user_id: number;
  recorded_at: string;
  type: PunchType;
  latitude: number | null;
  longitude: number | null;
  is_offline: number;
  synced: number;
  reject_reason: string | null;
  selfie_uri: string | null;
  created_at: string;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('cronos.db');
  }
  return dbPromise;
}

export async function initDatabase() {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_time_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      recorded_at TEXT NOT NULL,
      type TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      is_offline INTEGER NOT NULL DEFAULT 1,
      synced INTEGER NOT NULL DEFAULT 0,
      reject_reason TEXT,
      selfie_uri TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

export async function insertPunch(params: {
  hash: string;
  userId: number;
  recordedAt: string;
  type: PunchType;
  latitude: number | null;
  longitude: number | null;
  selfieUri: string | null;
}) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO pending_time_records (hash, user_id, recorded_at, type, latitude, longitude, is_offline, synced, selfie_uri, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ${SYNC_PENDING}, ?, ?)`,
    [params.hash, params.userId, params.recordedAt, params.type, params.latitude, params.longitude, params.selfieUri, new Date().toISOString()]
  );
}

export async function getPendingRecords(userId: number): Promise<PendingRecord[]> {
  const db = await getDb();
  return db.getAllAsync<PendingRecord>(
    `SELECT * FROM pending_time_records WHERE user_id = ? AND synced = ${SYNC_PENDING} ORDER BY recorded_at ASC`,
    [userId]
  );
}

export async function getPendingCount(userId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_time_records WHERE user_id = ? AND synced = ${SYNC_PENDING}`,
    [userId]
  );
  return row?.count ?? 0;
}

export async function markSynced(hash: string) {
  const db = await getDb();
  await db.runAsync(`UPDATE pending_time_records SET synced = ${SYNC_SYNCED} WHERE hash = ?`, [hash]);
}

export async function markRejected(hash: string, reason: string) {
  const db = await getDb();
  await db.runAsync(`UPDATE pending_time_records SET synced = ${SYNC_REJECTED}, reject_reason = ? WHERE hash = ?`, [
    reason,
    hash,
  ]);
}

/**
 * Recoloca uma marcação rejeitada na fila de sincronização (limpa o motivo),
 * usado pelo botão "Reenviar" da tela de pendências.
 */
export async function resetToPending(hash: string) {
  const db = await getDb();
  await db.runAsync(`UPDATE pending_time_records SET synced = ${SYNC_PENDING}, reject_reason = NULL WHERE hash = ?`, [hash]);
}

export async function getRecentRecords(userId: number, limit = 100): Promise<PendingRecord[]> {
  const db = await getDb();
  return db.getAllAsync<PendingRecord>(
    `SELECT * FROM pending_time_records WHERE user_id = ? ORDER BY recorded_at DESC LIMIT ?`,
    [userId, limit]
  );
}

export async function getLastRecord(userId: number): Promise<PendingRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<PendingRecord>(
    `SELECT * FROM pending_time_records WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 1`,
    [userId]
  );
  return row ?? null;
}

export async function upsertFromServer(params: {
  hash: string;
  userId: number;
  recordedAt: string;
  type: PunchType;
  latitude: number | null;
  longitude: number | null;
}) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO pending_time_records (hash, user_id, recorded_at, type, latitude, longitude, is_offline, synced, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ${SYNC_SYNCED}, ?)
     ON CONFLICT(hash) DO NOTHING`,
    [params.hash, params.userId, params.recordedAt, params.type, params.latitude, params.longitude, new Date().toISOString()]
  );
}
