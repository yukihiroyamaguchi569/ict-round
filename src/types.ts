export type Rating = 'A' | 'B' | 'C' | 'D' | 'E' | null;

export interface ChecklistItemDef {
  id: string;
  category: string;
  description: string;
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
}
