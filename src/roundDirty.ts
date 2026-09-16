import type { RoundData } from './types';

export function snapshotRound(roundData: RoundData): string {
  return JSON.stringify(roundData);
}

export function hasUnsavedChanges(roundData: RoundData, snapshot: string): boolean {
  return snapshotRound(roundData) !== snapshot;
}
