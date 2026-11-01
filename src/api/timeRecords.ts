import { api } from './client';
import type { PendingRecord } from '../db/database';

export type SyncResultStatus = 'created' | 'already_synced' | 'rejected';

/**
 * Marcação aceita pelo servidor MAS em quarentena: foi batida fora do raio permitido ou sem a
 * selfie exigida. Ela já está no servidor (o status vem como 'created', então sai da fila local),
 * só não entra na folha até o RH liberar na tela Marcações Divergentes. Antes, o servidor
 * devolvia 'rejected' nesses casos e a batida morria no celular.
 */
export type SyncDivergence = {
  status: 'pending' | 'approved' | 'rejected';
  reasons: string[];
  distance_m?: number;
};

export type SyncResult = {
  hash: string | null;
  status: SyncResultStatus;
  id?: number;
  reason?: string;
  distance_m?: number;
  divergence?: SyncDivergence;
};

export type SyncResponse = {
  message: string;
  summary: { created: number; already_synced: number; rejected: number; divergent?: number };
  results: SyncResult[];
};

/** Uma marcação pronta para subir: a selfie já resolvida para o caminho de HOJE (ou null). */
export type UploadableRecord = Omit<PendingRecord, 'selfie_uri'> & { selfie_uri: string | null };

/**
 * `timeoutMs` é obrigatório e NÃO usa o timeout do cliente (10s): é esse timeout curto, aplicado a
 * um lote de até 50 selfies, que travava a fila do app para sempre — ver src/lib/syncBatching.ts.
 * Quem chama calcula o teto pelo que o lote carrega.
 */
export async function syncTimeRecords(records: UploadableRecord[], timeoutMs: number): Promise<SyncResponse> {
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
    timeout: timeoutMs,
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
