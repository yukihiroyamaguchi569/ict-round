import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EMPTY_ROUND,
  formatStartTime,
  createRound,
  setRating,
  addPhoto,
  deleteItemPhoto,
  deleteGeneralPhoto,
  setEvaluation,
  setInspectorName,
  savedRoundTitle,
  buildSavedRound,
  saveErrorMessage,
} from '../roundData';
import type { Photo, RoundData, SavedChecklist } from '../types';

const CHECKLIST: SavedChecklist = {
  id: 'ward',
  name: '病棟用',
  createdAt: '2026-01-01T00:00:00.000Z',
  categories: [
    {
      category: '手指衛生',
      items: [
        { id: 'h1', category: '手指衛生', description: '消毒剤' },
        { id: 'h2', category: '手指衛生', description: '掲示' },
      ],
    },
    { category: '環境', items: [{ id: 'e1', category: '環境', description: '清掃' }] },
  ],
};

function photo(id: string): Photo {
  return { id, dataUrl: 'data:image/jpeg;base64,AA', comment: id, timestamp: '07:05' };
}

function round(): RoundData {
  return {
    inspectorName: '山田',
    wardName: '3東',
    startTime: '2026/10/06 07:00',
    checklistResults: [
      { itemId: 'h1', rating: 'A', photos: [photo('p1'), photo('p2')] },
      { itemId: 'h2', rating: null, photos: [] },
    ],
    generalPhotos: [photo('g1'), photo('g2')],
    overallEvaluation: '良好',
    checklistName: '病棟用',
  };
}

const QUOTA_MESSAGE =
  '保存容量の上限に達したため保存できませんでした。写真の枚数を減らすか、「保存済みラウンド」から不要なデータを削除してください。';
const GENERIC_MESSAGE = '保存に失敗しました。しばらくしてからもう一度お試しください。';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('EMPTY_ROUND', () => {
  it('has no participant, results, photos or evaluation', () => {
    expect(EMPTY_ROUND).toEqual({
      inspectorName: '',
      wardName: '',
      startTime: '',
      checklistResults: [],
      generalPhotos: [],
      overallEvaluation: '',
    });
  });
});

describe('formatStartTime', () => {
  it('formats the local date and time with zero padding', () => {
    vi.stubEnv('TZ', 'Asia/Tokyo');
    // 2026-01-02 03:04 in Tokyo
    expect(formatStartTime(new Date('2026-01-01T18:04:59Z'))).toBe('2026/01/02 03:04');
  });
});

describe('createRound', () => {
  it('lists every item of every category, unrated and without photos', () => {
    expect(createRound(CHECKLIST, '山田', '3東', 'T')).toEqual({
      inspectorName: '山田',
      wardName: '3東',
      startTime: 'T',
      checklistResults: [
        { itemId: 'h1', rating: null, photos: [] },
        { itemId: 'h2', rating: null, photos: [] },
        { itemId: 'e1', rating: null, photos: [] },
      ],
      generalPhotos: [],
      overallEvaluation: '',
      checklistName: '病棟用',
    });
  });

  it('gives an empty checklist no results', () => {
    expect(createRound({ ...CHECKLIST, categories: [] }, '山田', '', 'T').checklistResults).toEqual([]);
  });
});

describe('setRating', () => {
  it('rates only the matching item', () => {
    const next = setRating(round(), 'h2', 'C');
    expect(next.checklistResults.map((r) => r.rating)).toEqual(['A', 'C']);
  });

  it('clears a rating with null', () => {
    expect(setRating(round(), 'h1', null).checklistResults[0].rating).toBeNull();
  });

  it('keeps the photos of the rated item and the rest of the round', () => {
    const before = round();
    const next = setRating(before, 'h1', 'B');
    expect(next.checklistResults[0].photos).toEqual(before.checklistResults[0].photos);
    expect({ ...next, checklistResults: [] }).toEqual({ ...before, checklistResults: [] });
  });

  it('changes nothing for an unknown item and does not mutate the input', () => {
    const before = round();
    const snapshot = structuredClone(before);
    expect(setRating(before, 'missing', 'A')).toEqual(snapshot);
    setRating(before, 'h2', 'C');
    expect(before).toEqual(snapshot);
  });
});

describe('addPhoto', () => {
  it('appends to the general photos when no item is given', () => {
    const next = addPhoto(round(), photo('g3'));
    expect(next.generalPhotos.map((p) => p.id)).toEqual(['g1', 'g2', 'g3']);
    expect(next.checklistResults).toEqual(round().checklistResults);
  });

  it('treats an empty item id as a general photo', () => {
    expect(addPhoto(round(), photo('g3'), '').generalPhotos).toHaveLength(3);
  });

  it('appends to the photos of the given item only', () => {
    const next = addPhoto(round(), photo('p3'), 'h1');
    expect(next.checklistResults[0].photos.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
    expect(next.checklistResults[1].photos).toEqual([]);
    expect(next.generalPhotos).toEqual(round().generalPhotos);
  });

  it('keeps the rating of the item and does not mutate the input', () => {
    const before = round();
    const snapshot = structuredClone(before);
    expect(addPhoto(before, photo('p3'), 'h1').checklistResults[0].rating).toBe('A');
    addPhoto(before, photo('g3'));
    expect(before).toEqual(snapshot);
  });
});

describe('deleteItemPhoto', () => {
  it('removes the photo from the given item only', () => {
    const next = deleteItemPhoto(round(), 'h1', 'p1');
    expect(next.checklistResults[0]).toEqual({ itemId: 'h1', rating: 'A', photos: [photo('p2')] });
    expect(next.generalPhotos).toEqual(round().generalPhotos);
  });

  it('does not remove a photo with the same id from another item', () => {
    const before = addPhoto(round(), photo('p1'), 'h2');
    const next = deleteItemPhoto(before, 'h1', 'p1');
    expect(next.checklistResults[1].photos.map((p) => p.id)).toEqual(['p1']);
  });

  it('changes nothing for an unknown photo and does not mutate the input', () => {
    const before = round();
    const snapshot = structuredClone(before);
    expect(deleteItemPhoto(before, 'h1', 'missing')).toEqual(snapshot);
    deleteItemPhoto(before, 'h1', 'p1');
    expect(before).toEqual(snapshot);
  });
});

describe('deleteGeneralPhoto', () => {
  it('removes only the matching general photo', () => {
    const next = deleteGeneralPhoto(round(), 'g1');
    expect(next.generalPhotos.map((p) => p.id)).toEqual(['g2']);
    expect(next.checklistResults).toEqual(round().checklistResults);
  });

  it('changes nothing for an unknown photo and does not mutate the input', () => {
    const before = round();
    const snapshot = structuredClone(before);
    expect(deleteGeneralPhoto(before, 'missing')).toEqual(snapshot);
    deleteGeneralPhoto(before, 'g1');
    expect(before).toEqual(snapshot);
  });
});

describe('setEvaluation / setInspectorName', () => {
  it('replaces the overall evaluation as typed', () => {
    const before = round();
    expect(setEvaluation(before, '  要改善  ')).toEqual({ ...round(), overallEvaluation: '  要改善  ' });
    expect(before.overallEvaluation).toBe('良好');
  });

  it('replaces the participant name', () => {
    const before = round();
    expect(setInspectorName(before, '鈴木')).toEqual({ ...round(), inspectorName: '鈴木' });
    expect(before.inspectorName).toBe('山田');
  });
});

describe('savedRoundTitle', () => {
  it('joins the name and ward, followed by the start time', () => {
    expect(savedRoundTitle(round())).toBe('山田 / 3東（2026/10/06 07:00）');
  });

  it('leaves out the ward when it is empty', () => {
    expect(savedRoundTitle({ ...round(), wardName: '' })).toBe('山田（2026/10/06 07:00）');
  });
});

describe('buildSavedRound', () => {
  it('wraps the round with its id, title, save time, format version and checklist', () => {
    const data = round();
    expect(buildSavedRound('r1', data, 'ward', '2026-10-05T22:00:00.000Z')).toEqual({
      id: 'r1',
      title: '山田 / 3東（2026/10/06 07:00）',
      savedAt: '2026-10-05T22:00:00.000Z',
      version: 1,
      checklistId: 'ward',
      roundData: data,
    });
  });
});

describe('saveErrorMessage', () => {
  it.each(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'])('explains a full storage for %s', (name) => {
    expect(saveErrorMessage(new DOMException('full', name))).toBe(QUOTA_MESSAGE);
  });

  it('gives the generic message for another DOMException', () => {
    expect(saveErrorMessage(new DOMException('denied', 'SecurityError'))).toBe(GENERIC_MESSAGE);
  });

  it('gives the generic message for an Error named like a quota error', () => {
    const err = new Error('full');
    err.name = 'QuotaExceededError';
    expect(saveErrorMessage(err)).toBe(GENERIC_MESSAGE);
  });

  it('gives the generic message for a non-error value', () => {
    expect(saveErrorMessage('boom')).toBe(GENERIC_MESSAGE);
    expect(saveErrorMessage(undefined)).toBe(GENERIC_MESSAGE);
  });
});
