import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildSampleRound,
  SAMPLE_INSPECTOR_NAME,
  SAMPLE_WARD_NAME,
  SAMPLE_EVALUATION,
  SAMPLE_PHOTOS,
  type SamplePhotoImages,
} from '../sampleRound';
import { CHECKLIST_CATEGORIES, getAllItems } from '../checklistData';

// 2026-10-09 09:30 in Tokyo
const NOW = new Date('2026-10-09T00:30:00Z');

const ALL_PHOTOS: SamplePhotoImages = {
  'item-1': { dataUrl: 'data:image/jpeg;base64,AAAA', width: 640, height: 480 },
  'item-2': { dataUrl: 'data:image/jpeg;base64,BBBB', width: 480, height: 640 },
  'general-1': { dataUrl: 'data:image/jpeg;base64,CCCC' },
};

function resultOf(itemId: string, photos: SamplePhotoImages = ALL_PHOTOS) {
  const result = buildSampleRound(NOW, photos).checklistResults.find((r) => r.itemId === itemId);
  if (!result) throw new Error(`no result for ${itemId}`);
  return result;
}

// Node re-reads process.env.TZ when it changes, so this pins the zone regardless of the machine or CI.
beforeEach(() => vi.stubEnv('TZ', 'Asia/Tokyo'));
afterEach(() => vi.unstubAllEnvs());

describe('buildSampleRound', () => {
  it('fills in the sample participant, the ward marked as a sample, the start time and the default checklist name', () => {
    const round = buildSampleRound(NOW, {});
    expect(round.inspectorName).toBe('サンプル 太郎');
    expect(SAMPLE_INSPECTOR_NAME).toBe('サンプル 太郎');
    expect(round.wardName).toBe('【サンプル】3階東病棟');
    expect(SAMPLE_WARD_NAME).toBe(round.wardName);
    expect(round.startTime).toBe('2026/10/09 09:30');
    expect(round.checklistName).toBe('標準チェックリスト');
  });

  it('rates every item of the default checklist, in its order, with a mix of A, B and C', () => {
    const round = buildSampleRound(NOW, {});
    expect(round.checklistResults.map((r) => r.itemId)).toEqual(getAllItems(CHECKLIST_CATEGORIES).map((i) => i.id));
    expect(round.checklistResults.every((r) => r.rating !== null)).toBe(true);
    const ratings = new Set(round.checklistResults.map((r) => r.rating));
    expect(ratings).toEqual(new Set(['A', 'B', 'C']));
  });

  it('gives the items the evaluation mentions the ratings it describes', () => {
    expect(resultOf('hand-hygiene-2').rating).toBe('B');
    expect(resultOf('linen-2').rating).toBe('C');
    expect(resultOf('hand-hygiene-1').rating).toBe('A');
  });

  it('includes an overall evaluation of three to four sentences', () => {
    const round = buildSampleRound(NOW, {});
    expect(round.overallEvaluation).toBe(SAMPLE_EVALUATION);
    const sentences = SAMPLE_EVALUATION.split('。').filter((s) => s.trim());
    expect(sentences.length).toBeGreaterThanOrEqual(3);
    expect(sentences.length).toBeLessThanOrEqual(4);
  });

  it('links the two item photos to the hand sanitizer and medical waste items, and keeps one general photo', () => {
    const round = buildSampleRound(NOW, ALL_PHOTOS);

    const sanitizer = resultOf('hand-hygiene-2').photos;
    expect(sanitizer).toHaveLength(1);
    expect(sanitizer[0]).toMatchObject({ id: 'sample-item-1', dataUrl: 'data:image/jpeg;base64,AAAA', width: 640, height: 480 });
    expect(sanitizer[0].comment).not.toBe('');

    const waste = resultOf('linen-2').photos;
    expect(waste).toHaveLength(1);
    expect(waste[0]).toMatchObject({ id: 'sample-item-2', dataUrl: 'data:image/jpeg;base64,BBBB', width: 480, height: 640 });

    expect(round.generalPhotos).toHaveLength(1);
    expect(round.generalPhotos[0]).toMatchObject({ id: 'sample-general-1', dataUrl: 'data:image/jpeg;base64,CCCC' });
    expect(round.generalPhotos[0].width).toBeUndefined();

    const photoCount = round.checklistResults.reduce((n, r) => n + r.photos.length, 0);
    expect(photoCount).toBe(2);
  });

  it('stamps the photos with the start time in the same local format as photos taken in a round', () => {
    const round = buildSampleRound(NOW, ALL_PHOTOS);
    expect(round.generalPhotos[0].timestamp).toBe(NOW.toLocaleString('ja-JP'));
  });

  it('starts without photos when none could be loaded', () => {
    const round = buildSampleRound(NOW, {});
    expect(round.generalPhotos).toEqual([]);
    expect(round.checklistResults.every((r) => r.photos.length === 0)).toBe(true);
  });

  it('keeps only the photos that were loaded', () => {
    const round = buildSampleRound(NOW, { 'item-2': ALL_PHOTOS['item-2'] });
    expect(resultOf('hand-hygiene-2', { 'item-2': ALL_PHOTOS['item-2'] }).photos).toEqual([]);
    expect(resultOf('linen-2', { 'item-2': ALL_PHOTOS['item-2'] }).photos).toHaveLength(1);
    expect(round.generalPhotos).toEqual([]);
  });

  it('does not change the default checklist definition', () => {
    const before = JSON.stringify(CHECKLIST_CATEGORIES);
    buildSampleRound(NOW, ALL_PHOTOS);
    expect(JSON.stringify(CHECKLIST_CATEGORIES)).toBe(before);
  });
});

describe('SAMPLE_PHOTOS', () => {
  it('names the bundled files and links item photos only to items of the default checklist', () => {
    expect(SAMPLE_PHOTOS.map((p) => p.file)).toEqual(['sample/item-1.jpg', 'sample/item-2.jpg', 'sample/general-1.jpg']);
    const ids = new Set(getAllItems(CHECKLIST_CATEGORIES).map((i) => i.id));
    for (const photo of SAMPLE_PHOTOS) {
      if (photo.itemId) expect(ids.has(photo.itemId)).toBe(true);
    }
    expect(SAMPLE_PHOTOS.filter((p) => !p.itemId)).toHaveLength(1);
  });
});
