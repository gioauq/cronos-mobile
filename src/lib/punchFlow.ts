import type { PunchType } from '../db/database';

const CYCLE: PunchType[] = ['entrada', 'pausa_entrada', 'pausa_saida', 'saida'];

// Mesmo limite do servidor (cronos.lunch_return_max_minutes). O servidor também corrige na
// sincronização, então um app mais antigo ou um limite diferente não deixa a batida errada.
const LUNCH_RETURN_MAX_MINUTES = 90;

export const PUNCH_LABELS: Record<PunchType, string> = {
  entrada: 'Entrada',
  pausa_entrada: 'Almoço',
  pausa_saida: 'Retorno',
  saida: 'Saída',
};

// beforeType = tipo da batida ANTERIOR à última (quando houver).
type LastPunch = { type: PunchType; recordedAt: string; beforeType?: PunchType | null };

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * Próxima batida do ciclo (entrada → almoço → retorno → saída). O ciclo vale só dentro do dia:
 * quem esqueceu de bater a saída ontem começa hoje de novo em "Entrada" — antes o app continuava
 * a partir da última batida de qualquer dia, e a primeira batida da manhã virava "Saída". É a
 * mesma regra do servidor (PunchTypeResolver). O dia que ficou sem a saída segue sem ela, e o
 * ajuste de ponto pode ser pedido depois.
 *
 * Retorno do almoço esquecido: depois de "Almoço", se a próxima batida vier mais de 1h30 depois,
 * ela é a "Saída" — o retorno fica em branco para ajuste.
 */
export function nextPunchType(last: LastPunch | null, now: Date = new Date()): PunchType {
  if (!last) return 'entrada';

  const lastDate = new Date(last.recordedAt);
  if (Number.isNaN(lastDate.getTime()) || !isSameLocalDay(lastDate, now)) return 'entrada';

  if (last.type === 'pausa_entrada' && (now.getTime() - lastDate.getTime()) / 60000 > LUNCH_RETURN_MAX_MINUTES) {
    return 'saida';
  }

  // A saída anterior fechou o dia com o almoço aberto: outra batida depois dela é mais uma saída, não uma
  // entrada nova (senão quem deu um toque duplo de manhã terminaria o dia com uma "Entrada" às 17:53).
  if (last.type === 'saida' && last.beforeType === 'pausa_entrada') return 'saida';

  const index = CYCLE.indexOf(last.type);
  if (index === -1 || index === CYCLE.length - 1) return 'entrada';
  return CYCLE[index + 1];
}
