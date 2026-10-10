import { useState, useRef, useEffect } from 'react';
import type { Photo } from './types';
import { buildPhoto } from './roundData';
import { compressImage, isPhotoFileTooLarge, type ImageSize } from './photoImage';
import { newLocalId } from './localId';
import { trackEvent } from './analytics';
import { photoAgeBucket } from './photoAge';

export type PhotoSource = 'camera' | 'gallery';
type PendingAttempt = React.RefObject<PhotoSource | null>;
type TrackOutcome = (name: 'photo_add_success' | 'photo_add_failure', params: Record<string, string>) => void;

const skipOutcome: TrackOutcome = () => {};

/**
 * Takes the open photo_add_attempt of this input, so each attempt ends in at most one photo_add_success
 * or photo_add_failure. Returns the event sender to use for the outcome, or a no-op when no attempt of
 * this input is open (already settled, or the input was used without pressing its button).
 */
function takeAttempt(pending: PendingAttempt, method: PhotoSource): TrackOutcome {
  if (pending.current !== method) return skipOutcome;
  pending.current = null;
  return trackEvent;
}

/**
 * Records closing the picker / camera without a file. Uses the input's native cancel event because React
 * does not dispatch onCancel for <input>. Browsers without that event send nothing, which is accepted.
 */
function useCancelTracking(ref: React.RefObject<HTMLInputElement | null>, method: PhotoSource, pending: PendingAttempt) {
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const onCancel = () => takeAttempt(pending, method)('photo_add_failure', { method, reason: 'cancelled' });
    input.addEventListener('cancel', onCancel);
    return () => input.removeEventListener('cancel', onCancel);
  }, [ref, method, pending]);
}

/** The photo being added: picking and shrinking the image, the comment, and handing the finished Photo to onAdd. */
export function usePhotoDraft(onAdd: (photo: Photo) => void) {
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoSize, setPhotoSize] = useState<ImageSize | null>(null);
  const [comment, setComment] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const pendingAttempt = useRef<PhotoSource | null>(null);
  useCancelTracking(cameraInputRef, 'camera', pendingAttempt);
  useCancelTracking(galleryInputRef, 'gallery', pendingAttempt);

  const pickPhoto = (method: PhotoSource) => {
    trackEvent('photo_add_attempt', { method });
    pendingAttempt.current = method;
    (method === 'camera' ? cameraInputRef : galleryInputRef).current?.click();
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>, method: PhotoSource) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const pickedAt = Date.now();
    const trackOutcome = takeAttempt(pendingAttempt, method);
    if (isPhotoFileTooLarge(file.size)) {
      trackOutcome('photo_add_failure', { method, reason: 'too_large' });
      alert('ファイルサイズは10MB以下にしてください');
      return;
    }
    let image: Awaited<ReturnType<typeof compressImage>>;
    try {
      image = await compressImage(file);
    } catch {
      trackOutcome('photo_add_failure', { method, reason: 'compress_error' });
      alert('ファイルの読み込みに失敗しました');
      return;
    }
    // Only the coarse age bucket is sent: never the time, name, size or contents of the file.
    trackOutcome('photo_add_success', { method, photo_age: photoAgeBucket(file.lastModified, pickedAt) });
    setPhotoDataUrl(image.dataUrl);
    setPhotoSize({ width: image.width, height: image.height });
  };

  const clearPhoto = () => {
    setPhotoDataUrl('');
    if (cameraInputRef.current) { cameraInputRef.current.value = ''; }
    if (galleryInputRef.current) { galleryInputRef.current.value = ''; }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoDataUrl) return;
    onAdd(buildPhoto({ dataUrl: photoDataUrl, comment, size: photoSize }, newLocalId(), new Date()));
  };

  return {
    photoDataUrl,
    comment,
    setComment,
    cameraInputRef,
    galleryInputRef,
    pickPhoto,
    handlePhoto,
    clearPhoto,
    handleSubmit,
  };
}
