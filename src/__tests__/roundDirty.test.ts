import { describe, it, expect } from 'vitest';
import type { RoundData } from '../types';
import { snapshotRound, hasUnsavedChanges } from '../roundDirty';

function makeRound(): RoundData {
  return {
    inspectorName: '山田',
    wardName: '3階東',
    startTime: '2026/09/02 10:00',
    checklistResults: [
      { itemId: 'item-1', rating: null, photos: [] },
      { itemId: 'item-2', rating: null, photos: [] },
    ],
    generalPhotos: [],
    overallEvaluation: '',
    checklistName: 'デフォルト',
  };
}

describe('hasUnsavedChanges', () => {
  it('スナップショット時点から変更がなければ false', () => {
    const round = makeRound();
    const snapshot = snapshotRound(round);
    expect(hasUnsavedChanges(round, snapshot)).toBe(false);
  });

  it('同一内容の別オブジェクトでも false', () => {
    const snapshot = snapshotRound(makeRound());
    expect(hasUnsavedChanges(makeRound(), snapshot)).toBe(false);
  });

  it('評価を変更すると true', () => {
    const round = makeRound();
    const snapshot = snapshotRound(round);
    const changed: RoundData = {
      ...round,
      checklistResults: round.checklistResults.map((r) =>
        r.itemId === 'item-1' ? { ...r, rating: 'A' } : r
      ),
    };
    expect(hasUnsavedChanges(changed, snapshot)).toBe(true);
  });

  it('項目に写真を追加すると true', () => {
    const round = makeRound();
    const snapshot = snapshotRound(round);
    const photo = { id: 'p1', dataUrl: 'data:image/jpeg;base64,xxx', comment: '', timestamp: 't' };
    const changed: RoundData = {
      ...round,
      checklistResults: round.checklistResults.map((r) =>
        r.itemId === 'item-2' ? { ...r, photos: [photo] } : r
      ),
    };
    expect(hasUnsavedChanges(changed, snapshot)).toBe(true);
  });

  it('全体写真を追加すると true', () => {
    const round = makeRound();
    const snapshot = snapshotRound(round);
    const photo = { id: 'p1', dataUrl: 'data:image/jpeg;base64,xxx', comment: '', timestamp: 't' };
    expect(hasUnsavedChanges({ ...round, generalPhotos: [photo] }, snapshot)).toBe(true);
  });

  it('総評を入力すると true', () => {
    const round = makeRound();
    const snapshot = snapshotRound(round);
    expect(hasUnsavedChanges({ ...round, overallEvaluation: '良好' }, snapshot)).toBe(true);
  });

  it('担当者名を変更すると true', () => {
    const round = makeRound();
    const snapshot = snapshotRound(round);
    expect(hasUnsavedChanges({ ...round, inspectorName: '佐藤' }, snapshot)).toBe(true);
  });

  it('変更を元に戻すと再び false', () => {
    const round = makeRound();
    const snapshot = snapshotRound(round);
    const changed = { ...round, overallEvaluation: '一時的' };
    const reverted = { ...changed, overallEvaluation: '' };
    expect(hasUnsavedChanges(reverted, snapshot)).toBe(false);
  });
});
