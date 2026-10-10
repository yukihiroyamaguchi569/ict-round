import { describe, expect, it } from 'vitest';
import { photoAgeBucket } from '../photoAge';

const NOW = Date.UTC(2026, 9, 10, 3, 0, 0);
const SECOND = 1000;

describe('photoAgeBucket', () => {
  it.each([
    [0, 'under_1m'],
    [30 * SECOND, 'under_1m'],
    [60 * SECOND, 'under_1m'],
    [60 * SECOND + 1, '1m_10m'],
    [5 * 60 * SECOND, '1m_10m'],
    [600 * SECOND, '1m_10m'],
    [600 * SECOND + 1, 'over_10m'],
    [30 * 24 * 3600 * SECOND, 'over_10m'],
  ])('a file %i ms old is %s', (ageMs, expected) => {
    expect(photoAgeBucket(NOW - ageMs, NOW)).toBe(expected);
  });

  it('counts a file from the future (device clock skew) as under_1m', () => {
    expect(photoAgeBucket(NOW + 1, NOW)).toBe('under_1m');
    expect(photoAgeBucket(NOW + 3600 * SECOND, NOW)).toBe('under_1m');
  });

  it('counts a file with lastModified 0 (unknown) as over_10m', () => {
    expect(photoAgeBucket(0, NOW)).toBe('over_10m');
  });
});
