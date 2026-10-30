/** "sex., 21/11" a partir de AAAA-MM-DD (a data é de calendário: nunca passa pelo fuso do aparelho). */
export function formatShortDay(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(date);
}

/** "21/11" a partir de AAAA-MM-DD. */
export function formatDayMonth(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date);
}
