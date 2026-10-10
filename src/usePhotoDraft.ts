import { useState, useRef, useEffect } from 'react';
import type { Photo } from './types';
import { buildPhoto } from './roundData';
import { compressImage, isPhotoFileTooLarge, type ImageSize } from './photoImage';
import { newLocalId } from './localId';
import { trackEvent } from './analytics';
import { photoAgeBucket } from './photoAge';

export type PhotoSource = 'camera' | 'gallery';
type PhotoAddFailure = 'too_large' | 'compress_error' | 'cancelled';

// Each photo_add_attempt ends in at most one photo_add_success or photo_add_failure:
// a picker closes either with a file (change) or without one (cancel), and a picked file
// either fails the size check, fails to shrink, or succeeds.
function trackFailure(method: PhotoSource, reason: PhotoAddFailure) {
  trackEvent('photo_add_failure', { method, reason });
}

/**
 * Records closing the picker / camera without a file. Uses the input's native cancel event because React
 * does not dispatch onCancel for <input>. Browsers without that event send nothing, which is accepted.
 */
function useCancelTracking(ref: React.RefObject<HTMLInputElement | null>, method: PhotoSource) {
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    const onCancel = () => trackFailure(method, 'cancelled');
    input.addEventListener('cancel', onCancel);
    return () => input.removeEventListener('cancel', onCancel);
  }, [ref, method]);
}

/** The photo being added: picking and shrinking the image, the comment, and handing the finished Photo to onAdd. */
export function usePhotoDraft(onAdd: (photo: Photo) => void) {
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoSize, setPhotoSize] = useState<ImageSize | null>(null);
  const [comment, setComment] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  useCancelTracking(cameraInputRef, 'camera');
  useCancelTracking(galleryInputRef, 'gallery');

  const pickPhoto = (method: PhotoSource) => {
    trackEvent('photo_add_attempt', { method });
    (method === 'camera' ? cameraInputRef : galleryInputRef).current?.click();
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>, method: PhotoSource) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const pickedAt = Date.now();
    if (isPhotoFileTooLarge(file.size)) {
      trackFailure(method, 'too_large');
      alert('ファイルサイズは10MB以下にしてください');
      return;
    }
    let image: Awaited<ReturnType<typeof compressImage>>;
    try {
      image = await compressImage(file);
    } catch {
      trackFailure(method, 'compress_error');
      alert('ファイルの読み込みに失敗しました');
      return;
    }
    // Only the coarse age bucket is sent: never the time, name, size or contents of the file.
    trackEvent('photo_add_success', { method, photo_age: photoAgeBucket(file.lastModified, pickedAt) });
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
