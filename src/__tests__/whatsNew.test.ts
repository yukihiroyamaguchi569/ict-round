import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseReleases,
  compareVersions,
  pickUnseenReleases,
  loadLastSeenVersion,
  markVersionSeen,
  fetchReleases,
  needsReleaseCheck,
  type Release,
} from '../whatsNew';

const LAST_SEEN_VERSION_KEY = 'icn-round:last-seen-version';

function makeRelease(version: string): Release {
  return { version, date: '2026-09-01', changes: [`change ${version}`] };
}

function versions(releases: Release[]): string[] {
  return releases.map((r) => r.version);
}

describe('parseReleases', () => {
  it('keeps valid entries as-is', () => {
    const input = [
      { version: '1.13.0', date: '2026-09-16', changes: ['a', 'b'] },
      { version: '1.12.0', date: '2026-07-29', changes: [] },
    ];
    expect(parseReleases(input)).toEqual(input);
  });

  it.each([null, undefined, { version: '1.0.0' }, 'text', 42])('returns [] for non-array input %p', (input) => {
    expect(parseReleases(input)).toEqual([]);
  });

  it('drops invalid entries', () => {
    const input = [
      { date: '2026-09-16', changes: ['no version'] },
      { version: 1, date: '2026-09-16', changes: ['numeric version'] },
      { version: '1.1.0', changes: ['no date'] },
      { version: '1.2.0', date: '2026-09-16', changes: 'not an array' },
      null,
      'string',
      { version: '1.3.0', date: '2026-09-16', changes: ['ok'] },
    ];
    expect(versions(parseReleases(input))).toEqual(['1.3.0']);
  });

  it.each(['1.15.0-beta', 'v1.15.0', ''])('drops an entry with non-numeric version %p', (version) => {
    const input = [
      { version, date: '2026-09-16', changes: ['bad version'] },
      { version: '1.14.0', date: '2026-09-16', changes: ['ok'] },
    ];
    expect(versions(parseReleases(input))).toEqual(['1.14.0']);
  });

  it('drops non-string items inside changes', () => {
    const input = [{ version: '1.0.0', date: '2026-09-16', changes: ['a', 1, null, { x: 1 }, 'b'] }];
    expect(parseReleases(input)[0].changes).toEqual(['a', 'b']);
  });

  it('returns [] for an empty array', () => {
    expect(parseReleases([])).toEqual([]);
  });
});

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.13.0', '1.13.0')).toBe(0);
  });

  it('compares numerically, not lexically', () => {
    expect(compareVersions('1.10.0', '1.9.1')).toBeGreaterThan(0);
    expect(compareVersions('1.9.1', '1.10.0')).toBeLessThan(0);
  });

  it('compares each segment in order', () => {
    expect(compareVersions('2.0.0', '1.99.99')).toBeGreaterThan(0);
    expect(compareVersions('1.13.1', '1.13.0')).toBeGreaterThan(0);
  });

  it('treats missing segments as 0', () => {
    expect(compareVersions('1.13', '1.13.0')).toBe(0);
    expect(compareVersions('1.13.0', '1.13')).toBe(0);
    expect(compareVersions('1.13', '1.13.1')).toBeLessThan(0);
  });

  it('treats non-numeric segments as 0', () => {
    expect(compareVersions('1.x.0', '1.0.0')).toBe(0);
    expect(compareVersions('abc', '0.0.0')).toBe(0);
    expect(compareVersions('1.2.beta', '1.2.1')).toBeLessThan(0);
  });
});

describe('pickUnseenReleases', () => {
  const releases = ['1.13.0', '1.12.0', '1.11.0', '1.10.0'].map(makeRelease);

  it('returns only the latest entry when nothing has been seen', () => {
    expect(versions(pickUnseenReleases(releases, null, '1.13.0'))).toEqual(['1.13.0']);
  });

  it('returns every entry newer than the last seen version, newest first', () => {
    expect(versions(pickUnseenReleases(releases, '1.10.0', '1.13.0'))).toEqual(['1.13.0', '1.12.0', '1.11.0']);
  });

  it('returns nothing when the last seen version is the current version', () => {
    expect(pickUnseenReleases(releases, '1.13.0', '1.13.0')).toEqual([]);
  });

  it('returns the latest released entry without a record even when the current version has no entry', () => {
    expect(versions(pickUnseenReleases(releases, null, '1.13.1'))).toEqual(['1.13.0']);
  });

  it('returns nothing with a record when the current version has no entry and nothing newer was released', () => {
    expect(pickUnseenReleases(releases, '1.13.0', '1.13.1')).toEqual([]);
  });

  it('still returns unseen entries between the record and a current version without its own entry', () => {
    expect(versions(pickUnseenReleases(releases, '1.11.0', '1.13.1'))).toEqual(['1.13.0', '1.12.0']);
  });

  it('excludes entries newer than the current version', () => {
    const withFuture = [makeRelease('1.14.0'), ...releases];
    expect(versions(pickUnseenReleases(withFuture, '1.11.0', '1.13.0'))).toEqual(['1.13.0', '1.12.0']);
    expect(versions(pickUnseenReleases(withFuture, null, '1.13.0'))).toEqual(['1.13.0']);
  });

  it('orders by version regardless of input order', () => {
    const shuffled = ['1.11.0', '1.13.0', '1.9.0', '1.12.0', '1.10.0'].map(makeRelease);
    expect(versions(pickUnseenReleases(shuffled, '1.9.0', '1.13.0'))).toEqual([
      '1.13.0',
      '1.12.0',
      '1.11.0',
      '1.10.0',
    ]);
    expect(versions(pickUnseenReleases(shuffled, null, '1.13.0'))).toEqual(['1.13.0']);
  });

  it('does not mutate the input array', () => {
    const shuffled = ['1.11.0', '1.13.0', '1.12.0'].map(makeRelease);
    pickUnseenReleases(shuffled, null, '1.13.0');
    expect(versions(shuffled)).toEqual(['1.11.0', '1.13.0', '1.12.0']);
  });

  it('returns nothing for an empty list', () => {
    expect(pickUnseenReleases([], null, '1.13.0')).toEqual([]);
    expect(pickUnseenReleases([], '1.12.0', '1.13.0')).toEqual([]);
  });
});

describe('needsReleaseCheck', () => {
  it('returns true when nothing has been seen', () => {
    expect(needsReleaseCheck(null, '1.14.0')).toBe(true);
  });

  it('returns true when the record is older than the current version', () => {
    expect(needsReleaseCheck('1.13.0', '1.14.0')).toBe(true);
  });

  it('returns false when the record equals the current version', () => {
    expect(needsReleaseCheck('1.14.0', '1.14.0')).toBe(false);
  });

  it('returns false when the record is newer than the current version', () => {
    expect(needsReleaseCheck('1.15.0', '1.14.0')).toBe(false);
  });
});

describe('loadLastSeenVersion / markVersionSeen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when nothing is stored', () => {
    expect(loadLastSeenVersion()).toBeNull();
  });

  it.each(['', 'undefined', 'null', '1.2.x', ' 1.13.0'])('treats a non-numeric record %p as missing', (stored) => {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, stored);
    expect(loadLastSeenVersion()).toBeNull();
  });

  it('overwrites a corrupted record with the current version', () => {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, 'undefined');
    markVersionSeen('1.13.0');
    expect(loadLastSeenVersion()).toBe('1.13.0');
  });

  it('saves the current version when nothing is stored', () => {
    markVersionSeen('1.13.0');
    expect(loadLastSeenVersion()).toBe('1.13.0');
    expect(localStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('1.13.0');
  });

  it('overwrites an older record', () => {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, '1.12.0');
    markVersionSeen('1.13.0');
    expect(loadLastSeenVersion()).toBe('1.13.0');
  });

  it('does not write when the record equals the current version', () => {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, '1.13.0');
    const setItem = vi.spyOn(localStorage, 'setItem');
    markVersionSeen('1.13.0');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('does not overwrite a newer record (rollback)', () => {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, '1.14.0');
    const setItem = vi.spyOn(localStorage, 'setItem');
    markVersionSeen('1.13.0');
    expect(setItem).not.toHaveBeenCalled();
    expect(loadLastSeenVersion()).toBe('1.14.0');
  });

  it('returns null without throwing when localStorage.getItem throws', () => {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, '1.13.0');
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => loadLastSeenVersion()).not.toThrow();
    expect(loadLastSeenVersion()).toBeNull();
    expect(getItem).toHaveBeenCalled();
  });

  it('does not throw when localStorage.setItem throws', () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });
    expect(() => markVersionSeen('1.13.0')).not.toThrow();
    expect(setItem).toHaveBeenCalledOnce();
    expect(loadLastSeenVersion()).toBeNull();
  });
});

describe('fetchReleases', () => {
  const BASE_URL = '/ict-round/';
  const validJson = [{ version: '1.13.0', date: '2026-09-16', changes: ['a'] }];

  function fakeResponse(init: { ok: boolean; status?: number; json?: () => Promise<unknown> }): Response {
    return Object.assign(new Response(null, { status: init.status ?? (init.ok ? 200 : 404) }), {
      json: init.json ?? (() => Promise.resolve(validJson)),
    });
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns parsed releases on success', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      fakeResponse({ ok: true, json: () => Promise.resolve([...validJson, { bad: true }]) })
    );
    expect(await fetchReleases(BASE_URL, fetchFn)).toEqual(validJson);
  });

  it('requests updates/releases.json under the base URL with an abort signal', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(fakeResponse({ ok: true }));
    await fetchReleases(BASE_URL, fetchFn);
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/ict-round/updates/releases.json');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('returns null on an HTTP error without reading the body', async () => {
    const json = vi.fn(() => Promise.resolve(validJson));
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(fakeResponse({ ok: false, status: 404, json }));
    expect(await fetchReleases(BASE_URL, fetchFn)).toBeNull();
    expect(json).not.toHaveBeenCalled();
  });

  it('returns null when fetch rejects', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await fetchReleases(BASE_URL, fetchFn)).toBeNull();
  });

  it('returns null when the body is not valid JSON', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      fakeResponse({ ok: true, json: () => Promise.reject(new SyntaxError('Unexpected token')) })
    );
    expect(await fetchReleases(BASE_URL, fetchFn)).toBeNull();
  });

  it('returns null when the request times out', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })
    );
    const result = fetchReleases(BASE_URL, fetchFn, 5000);
    await vi.advanceTimersByTimeAsync(4999);
    expect(fetchFn.mock.calls[0][1]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the timeout timer after a successful response', async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(fakeResponse({ ok: true }));
    await fetchReleases(BASE_URL, fetchFn);
    expect(vi.getTimerCount()).toBe(0);
  });
});
