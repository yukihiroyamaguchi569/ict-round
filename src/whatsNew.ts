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

export function needsReleaseCheck(lastSeen: string | null, current: string): boolean {
  if (lastSeen === null) return true;
  return compareVersions(lastSeen, current) < 0;
}

const VERSION_PATTERN = /^\d+(\.\d+)*$/;

export function loadLastSeenVersion(): string | null {
  const stored = localStorage.getItem(LAST_SEEN_VERSION_KEY);
  // Treat a corrupted record as missing so it cannot compare as 0.0.0 and unlock the whole history.
  return stored !== null && VERSION_PATTERN.test(stored) ? stored : null;
}

export function markVersionSeen(current: string): void {
  const lastSeen = loadLastSeenVersion();
  // Never overwrite a newer record (rollback or a stale Service Worker shell).
  if (lastSeen !== null && compareVersions(lastSeen, current) >= 0) return;
  try {
    localStorage.setItem(LAST_SEEN_VERSION_KEY, current);
  } catch {
    // Storage is full or unavailable; the dialog will simply show again next time.
  }
}

// Returns null on any failure so callers can tell it apart from "no entries".
export async function fetchReleases(
  baseUrl: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 5000
): Promise<Release[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(`${baseUrl}updates/releases.json`, { signal: controller.signal });
    if (!response.ok) return null;
    return parseReleases(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
