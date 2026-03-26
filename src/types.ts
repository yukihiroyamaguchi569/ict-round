export interface Checkpoint {
  id: string;
  location: string;
  photoDataUrl: string;
  comment: string;
  timestamp: string;
}

export interface RoundData {
  inspectorName: string;
  startTime: string;
  checkpoints: Checkpoint[];
}
