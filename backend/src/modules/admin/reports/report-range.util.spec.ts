import {
  addDays,
  isValidYmd,
  listDays,
  previousRange,
  resolveRange,
} from './report-range.util';

describe('report-range.util', () => {
  it('valida fechas reales', () => {
    expect(isValidYmd('2026-11-26')).toBe(true);
    expect(isValidYmd('2026-02-30')).toBe(false);
    expect(isValidYmd('26/11/2026')).toBe(false);
  });

  it('resuelve el rango diario', () => {
    expect(resolveRange('day', '2026-11-26')).toEqual({
      startYmd: '2026-11-26',
      endYmd: '2026-11-27',
    });
  });

  it('resuelve la semana de lunes a domingo', () => {
    // 2026-11-26 es jueves.
    expect(resolveRange('week', '2026-11-26')).toEqual({
      startYmd: '2026-11-23',
      endYmd: '2026-11-30',
    });
    // Un domingo pertenece a la semana que empezó el lunes anterior.
    expect(resolveRange('week', '2026-11-29').startYmd).toBe('2026-11-23');
    // Un lunes abre su propia semana.
    expect(resolveRange('week', '2026-11-30').startYmd).toBe('2026-11-30');
  });

  it('resuelve el mes completo, incluso al cruzar de año', () => {
    expect(resolveRange('month', '2026-11-26')).toEqual({
      startYmd: '2026-11-01',
      endYmd: '2026-12-01',
    });
    expect(resolveRange('month', '2026-12-15').endYmd).toBe('2027-01-01');
  });

  it('calcula el periodo anterior', () => {
    expect(
      previousRange('day', resolveRange('day', '2026-11-26')).startYmd,
    ).toBe('2026-11-25');
    expect(
      previousRange('week', resolveRange('week', '2026-11-26')).startYmd,
    ).toBe('2026-11-16');
    expect(
      previousRange('month', resolveRange('month', '2026-01-10')),
    ).toEqual({ startYmd: '2025-12-01', endYmd: '2026-01-01' });
  });

  it('lista los días del rango', () => {
    expect(listDays(resolveRange('week', '2026-11-26'))).toHaveLength(7);
    expect(listDays(resolveRange('month', '2026-02-10'))).toHaveLength(28);
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
