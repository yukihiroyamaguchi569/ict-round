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

export interface SavedRound {
  id: string;
  title: string;
  savedAt: string;
  version: 1;
  checklistId: string;
  roundData: RoundData;
}
