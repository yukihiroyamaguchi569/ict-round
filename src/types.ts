export type Rating = 'A' | 'B' | 'C' | null;

export interface ChecklistItemDef {
  id: string;
  category: string;
  description: string;
}

export interface ChecklistCategory {
  category: string;
  items: ChecklistItemDef[];
}

export interface SavedChecklist {
  id: string;
  name: string;
  createdAt: string;
  isDefault?: boolean;
  categories: ChecklistCategory[];
}

export interface Photo {
  id: string;
  dataUrl: string;
  comment: string;
  timestamp: string;
  width?: number;
  height?: number;
}

export interface ChecklistItemResult {
  itemId: string;
  rating: Rating;
  photos: Photo[];
}

export interface RoundData {
  inspectorName: string;
  wardName: string;
  startTime: string;
  checklistResults: ChecklistItemResult[];
  generalPhotos: Photo[];
  overallEvaluation: string;
  checklistName?: string;
}

/**
 * 統合ページ（merge.html）へ受け渡すエクスポート形式。
 * 統合ページは localStorage を持たないため、チェックリスト定義を同梱する。
 * 項目の照合は端末ごとにランダムな checklistId ではなく itemId で行う。
 */
export interface RoundExport {
  format: 'meguru-round';
  version: 1;
  exportedAt: string;
  checklistName: string;
  categories: ChecklistCategory[];
  roundData: RoundData;
}

export interface SavedRound {
  id: string;
  title: string;
  savedAt: string;
  version: 1;
  checklistId: string;
  roundData: RoundData;
}
