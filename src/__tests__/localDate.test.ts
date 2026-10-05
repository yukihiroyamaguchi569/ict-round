import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { localDateString } from '../localDate';

// Node re-reads process.env.TZ when it changes, so this pins the zone regardless of the machine or CI.
beforeEach(() => {
  vi.stubEnv('TZ', 'Asia/Tokyo');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('localDateString', () => {
  it('JST の早朝（UTC ではまだ前日）でも端末のローカル日付を返す', () => {
    // 2026-10-06 07:00 JST
    expect(localDateString(new Date('2026-10-05T22:00:00Z'))).toBe('2026-10-06');
  });

  it('JST の 0:00 ちょうどはその日、直前の 23:59 は前日になる', () => {
    expect(localDateString(new Date('2026-10-05T15:00:00Z'))).toBe('2026-10-06');
    expect(localDateString(new Date('2026-10-05T14:59:59Z'))).toBe('2026-10-05');
  });

  it('年をまたぐ早朝も年月日すべてローカルで返す', () => {
    // 2027-01-01 00:30 JST
    expect(localDateString(new Date('2026-12-31T15:30:00Z'))).toBe('2027-01-01');
  });

  it('1桁の月と日は 0 で埋める', () => {
    expect(localDateString(new Date('2026-01-02T03:00:00Z'))).toBe('2026-01-02');
  });

  it('引数を省くと現在時刻のローカル日付を返す', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T22:00:00Z'));
    expect(localDateString()).toBe('2026-10-06');
  });
});
