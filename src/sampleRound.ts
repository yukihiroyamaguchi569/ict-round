import type { Photo, Rating, RoundData } from './types';
import { CHECKLIST_CATEGORIES } from './checklistData';
import { addPhoto, createRound, formatStartTime } from './roundData';

// The sample round a first-time user can try: the built-in checklist filled in, with photos and an
// overall evaluation, so the report can be exported right away. It is never saved.

export const SAMPLE_INSPECTOR_NAME = 'サンプル 太郎';
export const SAMPLE_WARD_NAME = '【サンプル】3階東病棟';

/** Same name as the built-in checklist seeded on first run. */
const SAMPLE_CHECKLIST = {
  id: 'sample',
  name: '標準チェックリスト',
  createdAt: '',
  categories: CHECKLIST_CATEGORIES,
};

/** Items rated other than A. The overall evaluation and the photo comments describe these. */
const SAMPLE_RATINGS: Record<string, Rating> = {
  'hand-hygiene-2': 'B',
  'water-2': 'B',
  'cleaning-1': 'B',
  'linen-2': 'C',
};

export const SAMPLE_EVALUATION =
  '全体として整理整頓が行き届いており、病室入退室時の手指衛生やPPEの設置状況は良好でした。' +
  '一方で、感染性廃棄物容器のふたが開いたままになっている場所があり、使用後は必ず閉めるよう病棟内での周知をお願いします。' +
  '手指消毒剤の開封日に年度の記載がないものや、シンク周りへの物品の掛け置き、ナースコールなど高頻度接触面の埃も見られました。' +
  '次回のラウンドで改善状況を確認します。';

export type SamplePhotoKey = 'item-1' | 'item-2' | 'general-1';

export interface SamplePhotoImage {
  dataUrl: string;
  width: number;
  height: number;
}

/** The photos that could be loaded; a missing key means that photo is left out of the sample. */
export type SamplePhotoImages = Partial<Record<SamplePhotoKey, SamplePhotoImage>>;

interface SamplePhotoDef {
  key: SamplePhotoKey;
  /** Path under the app's base URL (public/). */
  file: string;
  /** Checklist item the photo belongs to; none for a general photo. */
  itemId?: string;
  comment: string;
}

export const SAMPLE_PHOTOS: readonly SamplePhotoDef[] = [
  {
    key: 'item-1',
    file: 'sample/item-1.jpg',
    itemId: 'hand-hygiene-2',
    comment: '病室入口の手指消毒剤。開封日は書かれているが年度の記載がない',
  },
  {
    key: 'item-2',
    file: 'sample/item-2.jpg',
    itemId: 'linen-2',
    comment: '感染性廃棄物容器のふたが開いたままになっていた',
  },
  {
    key: 'general-1',
    file: 'sample/general-1.jpg',
    comment: 'ナースステーション全体。物品は整理されている',
  },
];

function samplePhoto(def: SamplePhotoDef, image: SamplePhotoImage, takenAt: Date): Photo {
  return {
    id: `sample-${def.key}`,
    dataUrl: image.dataUrl,
    comment: def.comment,
    timestamp: takenAt.toLocaleString('ja-JP'),
    width: image.width,
    height: image.height,
  };
}

/** The sample round started at `now`, with whichever of the sample photos were loaded. */
export function buildSampleRound(now: Date, images: SamplePhotoImages): RoundData {
  const round = createRound(SAMPLE_CHECKLIST, SAMPLE_INSPECTOR_NAME, SAMPLE_WARD_NAME, formatStartTime(now));
  const rated: RoundData = {
    ...round,
    checklistResults: round.checklistResults.map((r) => ({ ...r, rating: SAMPLE_RATINGS[r.itemId] ?? 'A' })),
    overallEvaluation: SAMPLE_EVALUATION,
  };
  return SAMPLE_PHOTOS.reduce((acc, def) => {
    const image = images[def.key];
    return image ? addPhoto(acc, samplePhoto(def, image, now), def.itemId) : acc;
  }, rated);
}
