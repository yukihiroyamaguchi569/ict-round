import { useRef } from 'react';
import { loadSamplePhotos } from './samplePhotos';
import type { SamplePhotoImages } from './sampleRound';

/**
 * Starts the sample round once its photos are loaded. A start abandoned while they load
 * (a normal round started, or the start screen left) is dropped when they arrive.
 */
export function useSampleStart(openSample: (photos: SamplePhotoImages) => void, onStarted: () => void) {
  // Bumped by every start and abandon; a load finishing under an older value is stale
  const generationRef = useRef(0);

  return {
    start: async (): Promise<void> => {
      generationRef.current += 1;
      const generation = generationRef.current;
      const photos = await loadSamplePhotos();
      if (generationRef.current !== generation) return;
      openSample(photos);
      onStarted();
    },
    abandon: () => {
      generationRef.current += 1;
    },
  };
}
