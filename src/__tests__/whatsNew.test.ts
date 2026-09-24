import { describe, it, expect } from 'vitest';
import {
  parseReleases,
  compareVersions,
  pickUnseenReleases,
  loadLastSeenVersion,
  saveLastSeenVersion,
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

describe('loadLastSeenVersion / saveLastSeenVersion', () => {
  it('returns null when nothing is stored', () => {
    expect(loadLastSeenVersion()).toBeNull();
  });

  it('reads back a saved version under the expected key', () => {
    saveLastSeenVersion('1.13.0');
    expect(loadLastSeenVersion()).toBe('1.13.0');
    expect(localStorage.getItem(LAST_SEEN_VERSION_KEY)).toBe('1.13.0');
  });

  it('overwrites the previous value', () => {
    saveLastSeenVersion('1.12.0');
    saveLastSeenVersion('1.13.0');
    expect(loadLastSeenVersion()).toBe('1.13.0');
  });
});
