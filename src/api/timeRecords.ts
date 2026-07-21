import { api } from './client';
import type { PendingRecord } from '../db/database';

export type SyncResultStatus = 'created' | 'already_synced' | 'rejected';

export type SyncResult = {
  hash: string | null;
  status: SyncResultStatus;
  id?: number;
  reason?: string;
  distance_m?: number;
};

export type SyncResponse = {
  message: string;
  summary: { created: number; already_synced: number; rejected: number };
  results: SyncResult[];
};

export async function syncTimeRecords(records: PendingRecord[]): Promise<SyncResponse> {
  const formData = new FormData();

  records.forEach((r, index) => {
    formData.append(`records[${index}][recorded_at]`, r.recorded_at);
    formData.append(`records[${index}][type]`, r.type);
    if (r.latitude != null) formData.append(`records[${index}][latitude]`, String(r.latitude));
    if (r.longitude != null) formData.append(`records[${index}][longitude]`, String(r.longitude));
    formData.append(`records[${index}][is_offline]`, r.is_offline ? '1' : '0');
    formData.append(`records[${index}][hash]`, r.hash);
    if (r.selfie_uri) {
      formData.append(`records[${index}][selfie]`, {
        uri: r.selfie_uri,
        name: `selfie-${r.hash}.jpg`,
        type: 'image/jpeg',
      } as unknown as Blob);
    }
  });

  const response = await api.post<SyncResponse>('/time-records/sync', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export type TodayRecord = {
  id: number;
  recorded_at: string;
  type: 'entrada' | 'saida' | 'pausa_entrada' | 'pausa_saida';
  latitude: number | null;
  longitude: number | null;
  hash: string | null;
};

export async function fetchTodayRecords(): Promise<TodayRecord[]> {
  const response = await api.get<{ records: TodayRecord[] }>('/time-records/today');
  return response.data.records;
}
