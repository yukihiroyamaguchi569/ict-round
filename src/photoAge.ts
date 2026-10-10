export type PhotoAge = 'under_1m' | '1m_10m' | 'over_10m';

const ONE_MINUTE_MS = 60 * 1000;
const TEN_MINUTES_MS = 10 * ONE_MINUTE_MS;

/**
 * Rounds how old the picked file is into a coarse bucket for analytics, so a photo taken on the spot
 * (under_1m) can be told apart from an older one picked from the library. Only the bucket is ever sent,
 * never the time itself. Each boundary belongs to the newer bucket, and a file from the future
 * (device clock skew) counts as under_1m.
 *
 * Caveat: some browsers set lastModified of a file picked from the gallery to the time it was picked,
 * so a gallery pick can also come out as under_1m. Read the bucket together with the method.
 */
export function photoAgeBucket(lastModified: number, now: number): PhotoAge {
  const age = now - lastModified;
  if (age <= ONE_MINUTE_MS) return 'under_1m';
  if (age <= TEN_MINUTES_MS) return '1m_10m';
  return 'over_10m';
}
