export type ReportPeriod = 'day' | 'week' | 'month';

export interface ReportRange {
  startYmd: string;
  /** Fecha final EXCLUSIVA. */
  endYmd: string;
}

const DAY_MS = 86_400_000;

const toMs = (ymd: string): number => {
  const [year, month, day] = ymd.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

const toYmd = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export function isValidYmd(ymd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  const ms = toMs(ymd);
  return !Number.isNaN(ms) && toYmd(ms) === ymd;
}

export function addDays(ymd: string, days: number): string {
  return toYmd(toMs(ymd) + days * DAY_MS);
}

/** Medianoche de Bolivia (UTC-4, sin horario de verano) para una fecha AAAA-MM-DD. */
export function boliviaMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000-04:00`);
}

export function resolveRange(
  period: ReportPeriod,
  anchorYmd: string,
): ReportRange {
  const anchor = toMs(anchorYmd);

  if (period === 'day') {
    return { startYmd: anchorYmd, endYmd: addDays(anchorYmd, 1) };
  }

  if (period === 'week') {
    // Semana de lunes a domingo.
    const offset = (new Date(anchor).getUTCDay() + 6) % 7;
    const startYmd = addDays(anchorYmd, -offset);
    return { startYmd, endYmd: addDays(startYmd, 7) };
  }

  const date = new Date(anchor);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    startYmd: toYmd(Date.UTC(year, month, 1)),
    endYmd: toYmd(Date.UTC(year, month + 1, 1)),
  };
}

export function previousRange(
  period: ReportPeriod,
  range: ReportRange,
): ReportRange {
  if (period === 'day') {
    return { startYmd: addDays(range.startYmd, -1), endYmd: range.startYmd };
  }
  if (period === 'week') {
    return { startYmd: addDays(range.startYmd, -7), endYmd: range.startYmd };
  }
  const start = new Date(toMs(range.startYmd));
  return {
    startYmd: toYmd(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1),
    ),
    endYmd: range.startYmd,
  };
}

export function listDays(range: ReportRange): string[] {
  const days: string[] = [];
  for (
    let cursor = range.startYmd;
    cursor < range.endYmd;
    cursor = addDays(cursor, 1)
  ) {
    days.push(cursor);
  }
  return days;
}
