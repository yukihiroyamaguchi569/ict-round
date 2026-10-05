import { useState, useRef } from 'react';
import type { Photo } from './types';
import { buildPhoto } from './roundData';
import { compressImage, isPhotoFileTooLarge, type ImageSize } from './photoImage';
import { newLocalId } from './localId';
import { trackEvent } from './analytics';

export type PhotoSource = 'camera' | 'gallery';

/** The photo being added: picking and shrinking the image, the comment, and handing the finished Photo to onAdd. */
export function usePhotoDraft(onAdd: (photo: Photo) => void) {
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoSize, setPhotoSize] = useState<ImageSize | null>(null);
  const [comment, setComment] = useState('');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const pickPhoto = (method: PhotoSource) => {
    trackEvent('photo_add_attempt', { method });
    (method === 'camera' ? cameraInputRef : galleryInputRef).current?.click();
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>, method: PhotoSource) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isPhotoFileTooLarge(file.size)) {
      alert('ファイルサイズは10MB以下にしてください');
      return;
    }
    try {
      const { dataUrl, width, height } = await compressImage(file);
      trackEvent('photo_add_success', { method });
      setPhotoDataUrl(dataUrl);
      setPhotoSize({ width, height });
    } catch {
      alert('ファイルの読み込みに失敗しました');
    }
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
