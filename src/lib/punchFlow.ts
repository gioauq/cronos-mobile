import type { PunchType } from '../db/database';

const CYCLE: PunchType[] = ['entrada', 'pausa_entrada', 'pausa_saida', 'saida'];

export const PUNCH_LABELS: Record<PunchType, string> = {
  entrada: 'Entrada',
  pausa_entrada: 'Almoço',
  pausa_saida: 'Retorno',
  saida: 'Saída',
};

type LastPunch = { type: PunchType; recordedAt: string };

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Próxima batida do ciclo (entrada → almoço → retorno → saída). O ciclo vale só dentro do dia:
 * quem esqueceu de bater a saída ontem começa hoje de novo em "Entrada" — antes o app continuava
 * a partir da última batida de qualquer dia, e a primeira batida da manhã virava "Saída". É a
 * mesma regra do servidor (PunchTypeResolver). O dia que ficou sem a saída segue sem ela, e o
 * ajuste de ponto pode ser pedido depois.
 */
export function nextPunchType(last: LastPunch | null, now: Date = new Date()): PunchType {
  if (!last) return 'entrada';

  const lastDate = new Date(last.recordedAt);
  if (Number.isNaN(lastDate.getTime()) || !isSameLocalDay(lastDate, now)) return 'entrada';

  const index = CYCLE.indexOf(last.type);
  if (index === -1 || index === CYCLE.length - 1) return 'entrada';
  return CYCLE[index + 1];
}
