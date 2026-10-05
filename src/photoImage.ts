export const MAX_PHOTO_FILE_BYTES = 10 * 1024 * 1024;

export interface ImageSize {
  width: number;
  height: number;
}

export function isPhotoFileTooLarge(size: number): boolean {
  return size > MAX_PHOTO_FILE_BYTES;
}

/** Scales down to maxWidth keeping the aspect ratio. Never scales up. */
export function fitToWidth(width: number, height: number, maxWidth: number): ImageSize {
  if (width <= maxWidth) return { width, height };
  return { width: maxWidth, height: Math.round(height * (maxWidth / width)) };
}

/** Decodes the image, shrinks it on a canvas and re-encodes it as JPEG. */
export async function compressImage(
  file: File,
  maxWidth = 640,
  quality = 0.8
): Promise<{ dataUrl: string } & ImageSize> {
  // imageOrientation: 'from-image' で EXIF の回転をピクセルへ反映する
  // （スマホ縦撮影の写真が90度回転する問題への対処）
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitToWidth(bitmap.width, bitmap.height, maxWidth);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); throw new Error('Canvas not supported'); }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width, height };
}
