import { afterEach, describe, expect, it, vi } from 'vitest';
import { ROUND_ENABLED } from '../facility/roundEnabled';

/** ROUND_ENABLED is read once when the module loads, so each case loads it afresh under the stubbed env. */
async function loadFlag(): Promise<boolean> {
  vi.resetModules();
  return (await import('../facility/roundEnabled')).ROUND_ENABLED;
}

describe('ROUND_ENABLED', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is on in the test run (vite.config.ts sets the flag for tests)', () => {
    expect(ROUND_ENABLED).toBe(true);
  });

  it('is true when the flag is "1"', async () => {
    vi.stubEnv('VITE_FACILITY_ROUND', '1');
    expect(await loadFlag()).toBe(true);
  });

  it('is false when the flag is not set', async () => {
    vi.stubEnv('VITE_FACILITY_ROUND', undefined);
    expect(await loadFlag()).toBe(false);
  });

  it.each(['0', 'true', '', ' 1'])('is false for any value other than "1" (%j)', async (value) => {
    vi.stubEnv('VITE_FACILITY_ROUND', value);
    expect(await loadFlag()).toBe(false);
  });
});
