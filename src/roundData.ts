import type { Photo, Rating, RoundData, SavedChecklist, SavedRound } from './types';

// Pure updates of the round being recorded. Each returns a new RoundData and leaves the input untouched.

export const EMPTY_ROUND: RoundData = {
  inspectorName: '',
  wardName: '',
  startTime: '',
  checklistResults: [],
  generalPhotos: [],
  overallEvaluation: '',
};

/** Round start time as shown in the report, e.g. "2026/10/06 07:00" (device time zone). */
export function formatStartTime(date: Date): string {
  return date.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** A fresh round with every item of the checklist unrated. */
export function createRound(
  checklist: SavedChecklist,
  inspectorName: string,
  wardName: string,
  startTime: string
): RoundData {
  return {
    inspectorName,
    wardName,
    startTime,
    checklistResults: checklist.categories.flatMap((cat) =>
      cat.items.map((item) => ({ itemId: item.id, rating: null, photos: [] }))
    ),
    generalPhotos: [],
    overallEvaluation: '',
    checklistName: checklist.name,
  };
}

export function setRating(round: RoundData, itemId: string, rating: Rating): RoundData {
  return {
    ...round,
    checklistResults: round.checklistResults.map((r) => (r.itemId === itemId ? { ...r, rating } : r)),
  };
}

/** Adds the photo to the item when itemId is given, otherwise to the general photos. */
export function addPhoto(round: RoundData, photo: Photo, itemId?: string): RoundData {
  if (itemId) {
    return {
      ...round,
      checklistResults: round.checklistResults.map((r) =>
        r.itemId === itemId ? { ...r, photos: [...r.photos, photo] } : r
      ),
    };
  }
  return { ...round, generalPhotos: [...round.generalPhotos, photo] };
}

export function deleteItemPhoto(round: RoundData, itemId: string, photoId: string): RoundData {
  return {
    ...round,
    checklistResults: round.checklistResults.map((r) =>
      r.itemId === itemId ? { ...r, photos: r.photos.filter((p) => p.id !== photoId) } : r
    ),
  };
}

export function deleteGeneralPhoto(round: RoundData, photoId: string): RoundData {
  return { ...round, generalPhotos: round.generalPhotos.filter((p) => p.id !== photoId) };
}

export function setEvaluation(round: RoundData, overallEvaluation: string): RoundData {
  return { ...round, overallEvaluation };
}

export function setInspectorName(round: RoundData, inspectorName: string): RoundData {
  return { ...round, inspectorName };
}

/** Title shown in the saved round list: "name / ward（start time）", without the ward part when it is empty. */
export function savedRoundTitle(round: RoundData): string {
  return round.inspectorName + (round.wardName ? ` / ${round.wardName}` : '') + `（${round.startTime}）`;
}

export function buildSavedRound(id: string, roundData: RoundData, checklistId: string, savedAt: string): SavedRound {
  return { id, title: savedRoundTitle(roundData), savedAt, version: 1, checklistId, roundData };
}

/** Message for a failed save; running out of storage gets advice on freeing space. */
export function saveErrorMessage(err: unknown): string {
  const quotaExceeded =
    err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
  return quotaExceeded
    ? '保存容量の上限に達したため保存できませんでした。写真の枚数を減らすか、「保存済みラウンド」から不要なデータを削除してください。'
    : '保存に失敗しました。しばらくしてからもう一度お試しください。';
}
