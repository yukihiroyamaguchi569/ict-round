// Whether this device has ever saved or exported a real (non-sample) round.
// Once it has, the start screen stops featuring the sample.
const ROUND_USED_KEY = 'icn-round:round-used';

export function hasUsedRounds(): boolean {
  try {
    return localStorage.getItem(ROUND_USED_KEY) === '1';
  } catch {
    // Storage is unavailable; treat the device as new.
    return false;
  }
}

export function markRoundsUsed(): void {
  try {
    localStorage.setItem(ROUND_USED_KEY, '1');
  } catch {
    // Storage is full or unavailable; the sample simply stays featured.
  }
}

/** The sample is featured only until a real round has been saved or exported, and while no round is saved. */
export function shouldFeatureSample(hasUsed: boolean, savedRoundsCount: number): boolean {
  return !hasUsed && savedRoundsCount === 0;
}
