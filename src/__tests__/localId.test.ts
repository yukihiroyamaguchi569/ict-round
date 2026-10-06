import { afterEach, describe, expect, it, vi } from 'vitest';
import { newLocalId } from '../localId';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('newLocalId', () => {
  it('joins the random digits after "0." with the current time, both in base 36', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(Date, 'now').mockReturnValue(36 * 36);
    // (0.5).toString(36) is "0.i", (1296).toString(36) is "100"
    expect(newLocalId()).toBe('i100');
  });

  it('gives different IDs for different random values at the same time', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1);
    vi.spyOn(Math, 'random').mockReturnValueOnce(0.25).mockReturnValueOnce(0.75);
    expect(newLocalId()).not.toBe(newLocalId());
  });

  it('uses only lowercase letters and digits', () => {
    expect(newLocalId()).toMatch(/^[0-9a-z]+$/);
  });
});
