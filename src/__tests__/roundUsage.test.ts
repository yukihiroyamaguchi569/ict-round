import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasUsedRounds, markRoundsUsed, shouldFeatureSample } from '../roundUsage';

const ROUND_USED_KEY = 'icn-round:round-used';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shouldFeatureSample', () => {
  it('features the sample on a device that has neither used rounds nor saved any', () => {
    expect(shouldFeatureSample(false, 0)).toBe(true);
  });

  it('stops featuring it once a round has been saved or exported', () => {
    expect(shouldFeatureSample(true, 0)).toBe(false);
  });

  it('stops featuring it while a saved round exists, even without the mark', () => {
    expect(shouldFeatureSample(false, 1)).toBe(false);
    expect(shouldFeatureSample(false, 5)).toBe(false);
  });

  it('does not feature it when both hold', () => {
    expect(shouldFeatureSample(true, 2)).toBe(false);
  });
});

describe('hasUsedRounds / markRoundsUsed', () => {
  it('is false on a new device and true after marking', () => {
    expect(hasUsedRounds()).toBe(false);
    markRoundsUsed();
    expect(localStorage.getItem(ROUND_USED_KEY)).toBe('1');
    expect(hasUsedRounds()).toBe(true);
  });

  it('stays true when marked again', () => {
    markRoundsUsed();
    markRoundsUsed();
    expect(hasUsedRounds()).toBe(true);
  });

  it.each(['0', '', 'true', 'yes'])('treats an unexpected stored value %p as not used', (value) => {
    localStorage.setItem(ROUND_USED_KEY, value);
    expect(hasUsedRounds()).toBe(false);
  });

  it('treats unreadable storage as not used', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(hasUsedRounds()).toBe(false);
  });

  it('ignores a failed write without throwing, and nothing is recorded', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => markRoundsUsed()).not.toThrow();
    expect(localStorage.getItem(ROUND_USED_KEY)).toBeNull();
  });
});
