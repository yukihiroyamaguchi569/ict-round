import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PHOTO_FILE_BYTES, compressImage, fitToWidth, isPhotoFileTooLarge } from '../photoImage';

describe('isPhotoFileTooLarge', () => {
  it('allows up to and including 10MB', () => {
    expect(MAX_PHOTO_FILE_BYTES).toBe(10 * 1024 * 1024);
    expect(isPhotoFileTooLarge(0)).toBe(false);
    expect(isPhotoFileTooLarge(MAX_PHOTO_FILE_BYTES)).toBe(false);
  });

  it('rejects anything over 10MB', () => {
    expect(isPhotoFileTooLarge(MAX_PHOTO_FILE_BYTES + 1)).toBe(true);
  });
});

describe('fitToWidth', () => {
  it('keeps an image at or below the limit as it is', () => {
    expect(fitToWidth(640, 1138, 640)).toEqual({ width: 640, height: 1138 });
    expect(fitToWidth(320, 240, 640)).toEqual({ width: 320, height: 240 });
  });

  it('scales a wider image down to the limit, keeping the aspect ratio', () => {
    expect(fitToWidth(1280, 960, 640)).toEqual({ width: 640, height: 480 });
    expect(fitToWidth(641, 641, 640)).toEqual({ width: 640, height: 640 });
  });

  it('rounds the height to the nearest pixel', () => {
    // 333 * 0.64 = 213.12, 1001 * 0.64 = 640.64
    expect(fitToWidth(1000, 333, 640)).toEqual({ width: 640, height: 213 });
    expect(fitToWidth(1000, 1001, 640)).toEqual({ width: 640, height: 641 });
  });
});

describe('compressImage', () => {
  let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> };
  let ctx: { drawImage: ReturnType<typeof vi.fn> } | null;
  let canvas: { width: number; height: number; getContext: ReturnType<typeof vi.fn>; toDataURL: ReturnType<typeof vi.fn> };
  const createImageBitmap = vi.fn();
  const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });

  beforeEach(() => {
    bitmap = { width: 1280, height: 960, close: vi.fn() };
    createImageBitmap.mockReset().mockResolvedValue(bitmap);
    ctx = { drawImage: vi.fn() };
    canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,AA'),
    };
    vi.stubGlobal('createImageBitmap', createImageBitmap);
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies the EXIF orientation, draws at 640px wide and encodes JPEG at quality 0.8', async () => {
    await expect(compressImage(file)).resolves.toEqual({ dataUrl: 'data:image/jpeg;base64,AA', width: 640, height: 480 });
    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    expect(document.createElement).toHaveBeenCalledWith('canvas');
    expect([canvas.width, canvas.height]).toEqual([640, 480]);
    expect(canvas.getContext).toHaveBeenCalledWith('2d');
    expect(ctx?.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 640, 480);
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
  });

  it('uses the given width limit and quality', async () => {
    await expect(compressImage(file, 320, 0.5)).resolves.toMatchObject({ width: 320, height: 240 });
    expect(canvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.5);
  });

  it('releases the bitmap and fails when the canvas has no 2D context', async () => {
    ctx = null;
    await expect(compressImage(file)).rejects.toThrow('Canvas not supported');
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(canvas.toDataURL).not.toHaveBeenCalled();
  });

  it('fails without touching a canvas when the image cannot be decoded', async () => {
    createImageBitmap.mockRejectedValue(new Error('decode failed'));
    await expect(compressImage(file)).rejects.toThrow('decode failed');
    expect(document.createElement).not.toHaveBeenCalled();
  });
});
