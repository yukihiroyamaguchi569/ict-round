import { afterEach, describe, expect, it, vi } from 'vitest';
import { isRoundEnabled } from '../facility/roundEnabled';

describe('isRoundEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is on in the test run (vite.config.ts sets the flag for tests)', () => {
    expect(isRoundEnabled()).toBe(true);
  });

  it('is true when the flag is "1"', () => {
    vi.stubEnv('VITE_FACILITY_ROUND', '1');
    expect(isRoundEnabled()).toBe(true);
  });

  it('is false when the flag is not set', () => {
    vi.stubEnv('VITE_FACILITY_ROUND', undefined);
    expect(isRoundEnabled()).toBe(false);
  });

  it.each(['0', 'true', '', ' 1'])('is false for any value other than "1" (%j)', (value) => {
    vi.stubEnv('VITE_FACILITY_ROUND', value);
    expect(isRoundEnabled()).toBe(false);
  });
});
