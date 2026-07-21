// SDK 57 moveu documentDirectory/downloadAsync para o subpath /legacy (API nova é baseada em File/Directory).
import * as FileSystem from 'expo-file-system/legacy';
import { api, API_BASE_URL } from './client';

export type JustificationType =
  | 'vacation'
  | 'medical'
  | 'business_trip'
  | 'breastfeeding'
  | 'course'
  | 'leave'
  | 'allowance'
  | 'justification'
  | 'other';

export const JUSTIFICATION_TYPE_LABELS: Record<JustificationType, string> = {
  vacation: 'Férias',
  medical: 'Licença Médica',
  business_trip: 'Viagem a Serviço',
  breastfeeding: 'Amamentação',
  course: 'Curso',
  leave: 'Licença',
  allowance: 'Abono',
  justification: 'Justificativa de Faltas',
  other: 'Outro',
};

export type TimesheetPunch = {
  id: number;
  time: string;
  selfie_url: string | null;
  latitude: string | null;
  longitude: string | null;
};

export type TimesheetDay = {
  date: string;
  is_work_day: boolean;
  status: 'not_calculated' | 'falta' | 'absence' | 'holiday' | 'day_off' | 'processed';
  punches: TimesheetPunch[];
  expected_hours: number;
  worked_hours: number;
  balance_hours: number;
  has_inconsistency: boolean;
};

export type TimesheetResponse = {
  user: { name: string; registration_number: string | null; email: string; photo_url: string | null };
  total_balance_hours: number;
  month: string;
  days: TimesheetDay[];
};

export async function fetchTimesheet(month?: string): Promise<TimesheetResponse> {
  const response = await api.get<TimesheetResponse>('/server/timesheet', {
    params: month ? { month } : undefined,
  });
  return response.data;
}

/**
 * Baixa o cartão de ponto em PDF do mês para o armazenamento local do app e
 * retorna o caminho do arquivo salvo, pronto para ser compartilhado/aberto.
 */
export async function downloadTimesheetPdf(month?: string): Promise<string> {
  const query = month ? `?month=${month}` : '';
  const fileName = `cartao-ponto${month ? `-${month}` : ''}.pdf`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;
  const authHeader = api.defaults.headers.common.Authorization as string | undefined;

  const result = await FileSystem.downloadAsync(`${API_BASE_URL}/server/timesheet/pdf${query}`, fileUri, {
    headers: authHeader ? { Authorization: authHeader } : {},
  });

  return result.uri;
}

/**
 * Baixa o comprovante em PDF de uma única marcação (não o cartão do mês inteiro).
 */
export async function downloadPunchReceipt(timeRecordId: number): Promise<string> {
  const fileName = `comprovante-marcacao-${timeRecordId}.pdf`;
  const fileUri = `${FileSystem.documentDirectory}${fileName}`;
  const authHeader = api.defaults.headers.common.Authorization as string | undefined;

  const result = await FileSystem.downloadAsync(`${API_BASE_URL}/time-records/${timeRecordId}/receipt`, fileUri, {
    headers: authHeader ? { Authorization: authHeader } : {},
  });

  return result.uri;
}

export type AttachmentFile = { uri: string; name: string; mimeType: string };

export async function submitJustification(params: {
  type: JustificationType;
  startDate: string;
  endDate: string;
  reason: string;
  attachment: AttachmentFile;
}): Promise<{ status: string; message: string }> {
  const formData = new FormData();
  formData.append('type', params.type);
  formData.append('start_date', params.startDate);
  formData.append('end_date', params.endDate);
  formData.append('reason', params.reason);
  formData.append('attachment', {
    uri: params.attachment.uri,
    name: params.attachment.name,
    type: params.attachment.mimeType,
  } as unknown as Blob);

  const response = await api.post('/server/justification', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function updateProfile(params: { email: string; photo?: AttachmentFile }): Promise<{ status: string }> {
  const formData = new FormData();
  formData.append('email', params.email);
  if (params.photo) {
    formData.append('photo', {
      uri: params.photo.uri,
      name: params.photo.name,
      type: params.photo.mimeType,
    } as unknown as Blob);
  }

  const response = await api.post('/server/profile', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export async function registerPushToken(pushToken: string | null): Promise<void> {
  await api.post('/server/push-token', { push_token: pushToken });
}
