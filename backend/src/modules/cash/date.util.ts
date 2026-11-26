/** Bolivia (America/La_Paz) es UTC-4 todo el año, sin horario de verano. */
export const TZ_OFFSET = '-04:00';

export function todayInBolivia(now = new Date()): string {
  const local = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}
