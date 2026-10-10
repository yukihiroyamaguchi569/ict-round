import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoForm from '../../components/PhotoForm';
import { ThemeProvider } from '../../ThemeContext';
import { trackEvent } from '../../analytics';
import type { ChecklistCategory } from '../../types';

vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));

const categories: ChecklistCategory[] = [
  { category: '手指衛生', items: [{ id: 'h1', category: '手指衛生', description: '手指消毒剤が配置されている' }] },
];

const DATA_URL = 'data:image/jpeg;base64,AAAA';
const MAX_BYTES = 10 * 1024 * 1024;

// jsdom has neither createImageBitmap nor a 2D canvas, so fake both and record how they are used.
let bitmap: { width: number; height: number; close: ReturnType<typeof vi.fn> };
let createImageBitmap: ReturnType<typeof vi.fn>;
let drawImage: ReturnType<typeof vi.fn>;
let getContext: ReturnType<typeof vi.spyOn>;
let toDataURL: ReturnType<typeof vi.spyOn>;
let alertSpy: ReturnType<typeof vi.spyOn>;

function useBitmap(width: number, height: number) {
  bitmap = { width, height, close: vi.fn() };
  createImageBitmap.mockResolvedValue(bitmap);
}

beforeEach(() => {
  vi.mocked(trackEvent).mockClear();
  createImageBitmap = vi.fn();
  vi.stubGlobal('createImageBitmap', createImageBitmap);
  useBitmap(1280, 960);
  drawImage = vi.fn();
  getContext = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() => ({ drawImage }) as unknown as CanvasRenderingContext2D);
  toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(DATA_URL);
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function renderForm(linkedItemId?: string) {
  const onAdd = vi.fn();
  const onCancel = vi.fn();
  const { container } = render(
    <ThemeProvider>
      <PhotoForm linkedItemId={linkedItemId} categories={categories} onAdd={onAdd} onCancel={onCancel} />
    </ThemeProvider>,
  );
  const inputs = container.querySelectorAll<HTMLInputElement>('input[type="file"]');
  const camera = [...inputs].find((i) => i.hasAttribute('capture'));
  const gallery = [...inputs].find((i) => !i.hasAttribute('capture'));
  if (!camera || !gallery) throw new Error('file inputs not found');
  return { onAdd, onCancel, camera, gallery, user: userEvent.setup() };
}

function jpeg(size?: number, lastModified?: number) {
  const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg', lastModified });
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
}

function submitButton() {
  return screen.getByRole('button', { name: '追加する' });
}

async function photoShown() {
  return screen.findByAltText('撮影済み');
}

/** Presses the source button, which records photo_add_attempt and opens the matching input. */
async function pressSource(user: ReturnType<typeof userEvent.setup>, method: 'camera' | 'gallery') {
  await user.click(screen.getByRole('button', { name: method === 'camera' ? '撮影' : 'ギャラリーから選択' }));
}

describe('PhotoForm: layout', () => {
  it('shows the linked item description when linked to a known item', () => {
    renderForm('h1');
    expect(screen.getByText('紐付き項目')).toBeInTheDocument();
    expect(screen.getByText('手指消毒剤が配置されている')).toBeInTheDocument();
  });

  it('shows no linked item for a general photo or an unknown item ID', () => {
    renderForm();
    expect(screen.queryByText('紐付き項目')).not.toBeInTheDocument();
    renderForm('missing');
    expect(screen.queryByText('紐付き項目')).not.toBeInTheDocument();
  });

  it('starts with the capture buttons and a disabled add button', () => {
    renderForm();
    expect(screen.getByRole('button', { name: '撮影' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ギャラリーから選択' })).toBeInTheDocument();
    expect(screen.queryByAltText('撮影済み')).not.toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });
});

describe('PhotoForm: picking a photo', () => {
  it('records the attempt and opens the matching file input', async () => {
    const { camera, gallery, user } = renderForm();
    const cameraClick = vi.spyOn(camera, 'click');
    const galleryClick = vi.spyOn(gallery, 'click');

    await user.click(screen.getByRole('button', { name: '撮影' }));
    expect(trackEvent).toHaveBeenLastCalledWith('photo_add_attempt', { method: 'camera' });
    expect(cameraClick).toHaveBeenCalledTimes(1);
    expect(galleryClick).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'ギャラリーから選択' }));
    expect(trackEvent).toHaveBeenLastCalledWith('photo_add_attempt', { method: 'gallery' });
    expect(galleryClick).toHaveBeenCalledTimes(1);
    expect(cameraClick).toHaveBeenCalledTimes(1);
  });

  it('scales a wide photo down to 640px, applying the EXIF orientation, and records success', async () => {
    const { camera, user } = renderForm();
    const file = jpeg();
    await pressSource(user, 'camera');
    await user.upload(camera, file);

    expect(await photoShown()).toHaveAttribute('src', DATA_URL);
    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
    expect(getContext).toHaveBeenCalledWith('2d');
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 640, 480);
    const canvas = toDataURL.mock.contexts[0] as HTMLCanvasElement;
    expect([canvas.width, canvas.height]).toEqual([640, 480]);
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.8);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('photo_add_success', { method: 'camera', photo_age: 'under_1m' });
    expect(alertSpy).not.toHaveBeenCalled();
    expect(submitButton()).toBeEnabled();
  });

  it('keeps a photo at or below 640px wide at its own size', async () => {
    const { gallery, user } = renderForm();
    useBitmap(640, 1138);
    await pressSource(user, 'gallery');
    await user.upload(gallery, jpeg());
    await photoShown();
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 640, 1138);
    expect(trackEvent).toHaveBeenCalledWith('photo_add_success', { method: 'gallery', photo_age: 'under_1m' });
  });

  it('rounds the scaled height', async () => {
    const { gallery, user } = renderForm();
    useBitmap(1000, 333);
    await user.upload(gallery, jpeg());
    await photoShown();
    // 333 * 0.64 = 213.12
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 640, 213);
  });

  it('accepts a file of exactly 10MB', async () => {
    const { gallery, user } = renderForm();
    await user.upload(gallery, jpeg(MAX_BYTES));
    await photoShown();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('rejects a file over 10MB without reading it', async () => {
    const { gallery, user } = renderForm();
    await user.upload(gallery, jpeg(MAX_BYTES + 1));
    expect(alertSpy).toHaveBeenCalledWith('ファイルサイズは10MB以下にしてください');
    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalledWith('photo_add_success', expect.anything());
    expect(screen.queryByAltText('撮影済み')).not.toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('does nothing when the picker is closed without a file', () => {
    const { gallery } = renderForm();
    fireEvent.change(gallery, { target: { files: [] } });
    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('alerts and keeps no photo when the image cannot be decoded', async () => {
    const { gallery, user } = renderForm();
    createImageBitmap.mockRejectedValue(new Error('decode failed'));
    await user.upload(gallery, jpeg());
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('ファイルの読み込みに失敗しました'));
    expect(trackEvent).not.toHaveBeenCalledWith('photo_add_success', expect.anything());
    expect(screen.queryByAltText('撮影済み')).not.toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it('alerts, releases the bitmap and keeps no photo when the canvas has no 2D context', async () => {
    const { gallery, user } = renderForm();
    getContext.mockReturnValue(null);
    await user.upload(gallery, jpeg());
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('ファイルの読み込みに失敗しました'));
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(toDataURL).not.toHaveBeenCalled();
    expect(screen.queryByAltText('撮影済み')).not.toBeInTheDocument();
  });

  it('removes the photo and clears both file inputs', async () => {
    const { camera, gallery, user } = renderForm();
    await user.upload(gallery, jpeg());
    await photoShown();
    expect(gallery.files).toHaveLength(1);

    // The remove button is the only unlabeled button next to the photo
    const remove = screen.getByAltText('撮影済み').nextElementSibling as HTMLButtonElement;
    await user.click(remove);
    expect(screen.queryByAltText('撮影済み')).not.toBeInTheDocument();
    expect(gallery.value).toBe('');
    expect(camera.value).toBe('');
    expect(screen.getByRole('button', { name: '撮影' })).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });
});

describe('PhotoForm: saving', () => {
  it('adds the photo with a generated ID, the local time, the trimmed comment and its size', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = new Date(2026, 9, 6, 9, 5, 3);
    vi.setSystemTime(now);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { gallery, onAdd, onCancel, user } = renderForm('h1');

    await user.upload(gallery, jpeg());
    await photoShown();
    await user.type(screen.getByLabelText('コメント'), '  床に汚れ  ');
    await user.click(submitButton());

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onAdd.mock.calls[0][0]).toStrictEqual({
      // (0.5).toString(36) is "0.i"
      id: 'i' + now.getTime().toString(36),
      dataUrl: DATA_URL,
      comment: '床に汚れ',
      timestamp: now.toLocaleString('ja-JP'),
      width: 640,
      height: 480,
    });
    expect(Object.keys(onAdd.mock.calls[0][0])).toEqual(['id', 'dataUrl', 'comment', 'timestamp', 'width', 'height']);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('adds an empty comment when none is typed', async () => {
    const { gallery, onAdd, user } = renderForm();
    await user.upload(gallery, jpeg());
    await photoShown();
    await user.click(submitButton());
    expect(onAdd.mock.calls[0][0].comment).toBe('');
  });

  it('does not add anything when the form is submitted without a photo', () => {
    const { onAdd } = renderForm();
    fireEvent.submit(submitButton().closest('form') as HTMLFormElement);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('calls only onCancel when going back', async () => {
    const { onAdd, onCancel, user } = renderForm();
    await user.click(screen.getByRole('button', { name: /もどる|戻る/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('PhotoForm: photo add analytics', () => {
  const NOW = new Date(2026, 9, 10, 9, 0, 0).getTime();

  function useFixedNow() {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  }

  it.each([
    [30 * 1000, 'under_1m'],
    [5 * 60 * 1000, '1m_10m'],
    [3 * 3600 * 1000, 'over_10m'],
  ])('sends only the method and the age bucket on success (file %i ms old -> %s)', async (ageMs, bucket) => {
    useFixedNow();
    const { camera, user } = renderForm();
    await user.click(screen.getByRole('button', { name: '撮影' }));
    await user.upload(camera, jpeg(2048, NOW - ageMs));
    await photoShown();
    // Exactly one attempt and one success, carrying no time, file name or size.
    expect(vi.mocked(trackEvent).mock.calls).toStrictEqual([
      ['photo_add_attempt', { method: 'camera' }],
      ['photo_add_success', { method: 'camera', photo_age: bucket }],
    ]);
  });

  it('counts a file from the future (device clock skew) as under_1m', async () => {
    useFixedNow();
    const { gallery, user } = renderForm();
    await pressSource(user, 'gallery');
    await user.upload(gallery, jpeg(undefined, NOW + 3600 * 1000));
    await photoShown();
    expect(trackEvent).toHaveBeenCalledWith('photo_add_success', { method: 'gallery', photo_age: 'under_1m' });
  });

  it('sends too_large, and no success, for a file over 10MB', async () => {
    const { gallery, user } = renderForm();
    await pressSource(user, 'gallery');
    await user.upload(gallery, jpeg(MAX_BYTES + 1));
    expect(alertSpy).toHaveBeenCalledWith('ファイルサイズは10MB以下にしてください');
    expect(vi.mocked(trackEvent).mock.calls).toStrictEqual([
      ['photo_add_attempt', { method: 'gallery' }],
      ['photo_add_failure', { method: 'gallery', reason: 'too_large' }],
    ]);
  });

  it('sends compress_error, and no success, when the image cannot be decoded', async () => {
    const { camera, user } = renderForm();
    createImageBitmap.mockRejectedValue(new Error('decode failed'));
    await pressSource(user, 'camera');
    await user.upload(camera, jpeg());
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('ファイルの読み込みに失敗しました'));
    expect(vi.mocked(trackEvent).mock.calls).toStrictEqual([
      ['photo_add_attempt', { method: 'camera' }],
      ['photo_add_failure', { method: 'camera', reason: 'compress_error' }],
    ]);
  });

  it('sends compress_error when the canvas has no 2D context', async () => {
    const { gallery, user } = renderForm();
    getContext.mockReturnValue(null);
    await pressSource(user, 'gallery');
    await user.upload(gallery, jpeg());
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(vi.mocked(trackEvent).mock.calls).toStrictEqual([
      ['photo_add_attempt', { method: 'gallery' }],
      ['photo_add_failure', { method: 'gallery', reason: 'compress_error' }],
    ]);
  });

  it.each(['camera', 'gallery'] as const)('sends cancelled when the %s picker is closed without a file', async (method) => {
    const { camera, gallery, user } = renderForm();
    await pressSource(user, method);
    fireEvent(method === 'camera' ? camera : gallery, new Event('cancel'));
    expect(vi.mocked(trackEvent).mock.calls).toStrictEqual([
      ['photo_add_attempt', { method }],
      ['photo_add_failure', { method, reason: 'cancelled' }],
    ]);
    expect(createImageBitmap).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['too_large', () => jpeg(MAX_BYTES + 1)],
    ['compress_error', () => { createImageBitmap.mockRejectedValueOnce(new Error('decode failed')); return jpeg(); }],
  ])('clears the input after %s so the same file can be retried as a new attempt', async (reason, makeFile) => {
    const { gallery, user } = renderForm();
    await pressSource(user, 'gallery');
    await user.upload(gallery, makeFile());
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    expect(gallery.value).toBe('');
    expect(gallery.files).toHaveLength(0);

    await pressSource(user, 'gallery');
    await user.upload(gallery, jpeg());
    await photoShown();
    expect(vi.mocked(trackEvent).mock.calls).toStrictEqual([
      ['photo_add_attempt', { method: 'gallery' }],
      ['photo_add_failure', { method: 'gallery', reason }],
      ['photo_add_attempt', { method: 'gallery' }],
      ['photo_add_success', { method: 'gallery', photo_age: 'under_1m' }],
    ]);
  });

  it('sends a single outcome per attempt even if cancel fires twice', async () => {
    const { gallery, user } = renderForm();
    await pressSource(user, 'gallery');
    fireEvent(gallery, new Event('cancel'));
    fireEvent(gallery, new Event('cancel'));
    expect(vi.mocked(trackEvent).mock.calls).toStrictEqual([
      ['photo_add_attempt', { method: 'gallery' }],
      ['photo_add_failure', { method: 'gallery', reason: 'cancelled' }],
    ]);
  });

  it('sends no cancelled after the attempt already ended in success', async () => {
    const { camera, user } = renderForm();
    await pressSource(user, 'camera');
    await user.upload(camera, jpeg());
    await photoShown();
    fireEvent(camera, new Event('cancel'));
    expect(trackEvent).toHaveBeenCalledTimes(2);
    expect(trackEvent).not.toHaveBeenCalledWith('photo_add_failure', expect.anything());
  });

  it('settles only the attempt of the input that was opened last', async () => {
    const { camera, gallery, user } = renderForm();
    await pressSource(user, 'camera');
    await pressSource(user, 'gallery');
    fireEvent(camera, new Event('cancel'));
    await user.upload(gallery, jpeg());
    await photoShown();
    expect(vi.mocked(trackEvent).mock.calls.map(([name]) => name)).toEqual([
      'photo_add_attempt',
      'photo_add_attempt',
      'photo_add_success',
    ]);
    expect(trackEvent).toHaveBeenLastCalledWith('photo_add_success', { method: 'gallery', photo_age: 'under_1m' });
  });

  it('sends no outcome without an attempt, but still adds the photo', async () => {
    const { gallery, user } = renderForm();
    fireEvent(gallery, new Event('cancel'));
    await user.upload(gallery, jpeg());
    await photoShown();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(submitButton()).toBeEnabled();
  });

  it('stops listening for cancel once the form is gone', async () => {
    const { gallery, user } = renderForm();
    await pressSource(user, 'gallery');
    cleanup();
    fireEvent(gallery, new Event('cancel'));
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('sends neither success nor failure when a change carries no file', async () => {
    const { camera, user } = renderForm();
    await pressSource(user, 'camera');
    fireEvent.change(camera, { target: { files: [] } });
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });
});
