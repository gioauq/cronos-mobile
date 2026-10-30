import axios from 'axios';
import { api } from './client';

export type SwapStatus =
  | 'awaiting_counterpart'
  | 'awaiting_approval'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'cancelled';

/** Uma troca como o servidor a vê (o que ela é para ele, em que pé está e o que ele pode fazer). */
export type SwapItem = {
  id: number;
  status: SwapStatus;
  status_label: string;
  role: 'requester' | 'counterpart';
  other_name: string | null;
  service_date: string | null;
  payback_date: string | null;
  reason: string | null;
  can_accept: boolean;
  can_decline: boolean;
  can_cancel: boolean;
};

export type UpcomingShift = { date: string; label: string; pending: boolean };

export type SwapOverview = {
  upcoming_shifts: UpcomingShift[];
  incoming: SwapItem[];
  mine: SwapItem[];
};

export type SwapCandidate = {
  id: number;
  name: string;
  registration_number: string | null;
  schedule: string | null;
  unit: string | null;
  hints: string[];
};

export async function fetchSwaps(): Promise<SwapOverview> {
  const response = await api.get<SwapOverview>('/server/swaps');
  return response.data;
}

/** Quem pode cobrir o plantão do dia: só colegas livres e que também respondem pelo app. */
export async function fetchSwapCandidates(date: string, search?: string): Promise<SwapCandidate[]> {
  const response = await api.get<{ candidates: SwapCandidate[] }>('/server/swaps/candidates', {
    params: { date, search: search || undefined },
  });
  return response.data.candidates;
}

/** Dias possíveis para devolver o plantão àquele colega (daqui para a frente). */
export async function fetchPaybackDates(date: string, counterpartId: number): Promise<string[]> {
  const response = await api.get<{ dates: { date: string }[] }>('/server/swaps/payback-dates', {
    params: { date, counterpart_id: counterpartId },
  });
  return response.data.dates.map((item) => item.date);
}

export async function requestSwap(params: {
  date: string;
  counterpartId: number;
  paybackDate: string;
  reason: string;
}): Promise<SwapItem> {
  const response = await api.post<{ swap: SwapItem }>('/server/swaps', {
    date: params.date,
    counterpart_id: params.counterpartId,
    payback_date: params.paybackDate,
    reason: params.reason.trim() || undefined,
  });
  return response.data.swap;
}

async function answer(id: number, action: 'accept' | 'decline' | 'cancel'): Promise<SwapItem> {
  const response = await api.post<{ swap: SwapItem }>(`/server/swaps/${id}/${action}`);
  return response.data.swap;
}

export const acceptSwap = (id: number) => answer(id, 'accept');
export const declineSwap = (id: number) => answer(id, 'decline');
export const cancelSwap = (id: number) => answer(id, 'cancel');

/** A recusa de regra do servidor (422/403) vem com o motivo em `message`; sem resposta, é problema de conexão. */
export function swapErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error) && typeof error.response?.data?.message === 'string') {
    return error.response.data.message;
  }
  return fallback;
}
