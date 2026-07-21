import type { PunchType } from '../db/database';

const CYCLE: PunchType[] = ['entrada', 'pausa_entrada', 'pausa_saida', 'saida'];

export const PUNCH_LABELS: Record<PunchType, string> = {
  entrada: 'Entrada',
  pausa_entrada: 'Almoço',
  pausa_saida: 'Retorno',
  saida: 'Saída',
};

export function nextPunchType(lastType: PunchType | null): PunchType {
  if (!lastType) return 'entrada';
  const index = CYCLE.indexOf(lastType);
  if (index === -1 || index === CYCLE.length - 1) return 'entrada';
  return CYCLE[index + 1];
}
