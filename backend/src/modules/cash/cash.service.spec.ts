import { todayInBolivia } from './date.util';

describe('todayInBolivia', () => {
  it('usa la fecha local de Bolivia (UTC-4)', () => {
    expect(todayInBolivia(new Date('2026-11-17T02:30:00Z'))).toBe('2026-11-16');
    expect(todayInBolivia(new Date('2026-11-17T04:00:00Z'))).toBe('2026-11-17');
    expect(todayInBolivia(new Date('2026-11-17T23:59:00Z'))).toBe('2026-11-17');
  });
});
