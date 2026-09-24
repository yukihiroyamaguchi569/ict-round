export interface Release {
  version: string;
  date: string;
  changes: string[];
}

const LAST_SEEN_VERSION_KEY = 'icn-round:last-seen-version';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseRelease(value: unknown): Release | null {
  if (!isRecord(value)) return null;
  const { version, date, changes } = value;
  if (typeof version !== 'string' || typeof date !== 'string' || !Array.isArray(changes)) {
    return null;
  }
  return {
    version,
    date,
    changes: changes.filter((c): c is string => typeof c === 'string'),
  };
}

export function parseReleases(input: unknown): Release[] {
  if (!Array.isArray(input)) return [];
  return input.map(parseRelease).filter((r): r is Release => r !== null);
}

function toVersionParts(version: string): number[] {
  return version.split('.').map((part) => {
    const n = Number(part);
    return Number.isFinite(n) ? n : 0;
  });
}

export function compareVersions(a: string, b: string): number {
  const pa = toVersionParts(a);
  const pb = toVersionParts(b);
  const length = Math.max(pa.length, pb.length);
  for (let i = 0; i < length; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

export function pickUnseenReleases(
  releases: Release[],
  lastSeen: string | null,
  current: string
): Release[] {
  const released = releases
    .filter((r) => compareVersions(r.version, current) <= 0)
    .sort((a, b) => compareVersions(b.version, a.version));
  if (lastSeen === null) {
    // Without a record, announce only the latest released entry once.
    return released.slice(0, 1);
  }
  return released.filter((r) => compareVersions(r.version, lastSeen) > 0);
}

export function loadLastSeenVersion(): string | null {
  return localStorage.getItem(LAST_SEEN_VERSION_KEY);
}

export function saveLastSeenVersion(version: string): void {
  localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
}
