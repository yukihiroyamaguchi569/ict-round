import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatStartedAt, fromDateTimeLocal, toDateTimeLocal } from '../facility/dateTimeLocal';

beforeEach(() => vi.stubEnv('TZ', 'Asia/Tokyo'));
afterEach(() => vi.unstubAllEnvs());

describe('toDateTimeLocal', () => {
  it('gives the device-local date and time, zero-padded, without seconds', () => {
    // 2026-03-04 05:06:59 in Tokyo.
    expect(toDateTimeLocal(new Date('2026-03-03T20:06:59Z'))).toBe('2026-03-04T05:06');
  });

  it('uses the local date across the UTC day boundary', () => {
    expect(toDateTimeLocal(new Date('2026-12-31T15:30:00Z'))).toBe('2027-01-01T00:30');
  });
});

describe('fromDateTimeLocal', () => {
  it('reads the value as local time', () => {
    expect(fromDateTimeLocal('2026-11-18T10:30')?.toISOString()).toBe('2026-11-18T01:30:00.000Z');
  });

  it('round-trips with toDateTimeLocal', () => {
    expect(toDateTimeLocal(fromDateTimeLocal('2026-02-28T23:59') ?? new Date(0))).toBe('2026-02-28T23:59');
  });

  it.each(['', '2026-11-18', '2026-11-18T10:30:00', '2026-11-18 10:30', 'abc', '2026-1-18T10:30'])(
    'is null for a value that is not YYYY-MM-DDTHH:mm (%j)',
    (value) => {
      expect(fromDateTimeLocal(value)).toBeNull();
    }
  );

  it.each(['2026-02-29T10:00', '2026-13-01T10:00', '2026-04-31T10:00', '2026-11-18T24:00', '2026-11-18T10:60'])(
    'is null for a date or time that does not exist (%j)',
    (value) => {
      expect(fromDateTimeLocal(value)).toBeNull();
    }
  );

  it('keeps a two-digit year as it is instead of reading it as 19xx', () => {
    expect(fromDateTimeLocal('0026-11-18T10:30')?.getFullYear()).toBe(26);
  });

  it('accepts a leap day', () => {
    expect(fromDateTimeLocal('2028-02-29T00:00')).not.toBeNull();
  });
});

describe('formatStartedAt', () => {
  it('shows the stored ISO time in the device time zone', () => {
    expect(formatStartedAt('2026-11-18T01:05:00.000Z')).toBe('2026/11/18 10:05');
  });

  it('shows an unreadable value as it is', () => {
    expect(formatStartedAt('not a date')).toBe('not a date');
  });
});
