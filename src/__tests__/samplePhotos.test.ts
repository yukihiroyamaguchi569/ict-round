import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSamplePhotos, type SamplePhotoDeps } from '../samplePhotos';

const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from(JPEG_BYTES).toString('base64')}`;

function jpegResponse(): Response {
  return new Response(JPEG_BYTES, { headers: { 'Content-Type': 'image/jpeg' } });
}

type FetchFn = NonNullable<SamplePhotoDeps['fetchFn']>;

function fakeFetch(respond: (url: string, init?: RequestInit) => Promise<Response>) {
  return vi.fn<FetchFn>((input, init) => respond(String(input), init));
}

const measure = vi.fn<NonNullable<SamplePhotoDeps['measure']>>(() => Promise.resolve({ width: 640, height: 480 }));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  measure.mockClear();
});

describe('loadSamplePhotos', () => {
  it('fetches the three bundled photos and returns them as data URLs with their size', async () => {
    const fetchFn = fakeFetch(() => Promise.resolve(jpegResponse()));

    const photos = await loadSamplePhotos({ fetchFn, measure, baseUrl: './' });

    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
      './sample/item-1.jpg',
      './sample/item-2.jpg',
      './sample/general-1.jpg',
    ]);
    expect(photos).toEqual({
      'item-1': { dataUrl: JPEG_DATA_URL, width: 640, height: 480 },
      'item-2': { dataUrl: JPEG_DATA_URL, width: 640, height: 480 },
      'general-1': { dataUrl: JPEG_DATA_URL, width: 640, height: 480 },
    });
  });

  it('passes an abort signal to every request', async () => {
    const fetchFn = fakeFetch(() => Promise.resolve(jpegResponse()));
    await loadSamplePhotos({ fetchFn, measure });
    for (const [, init] of fetchFn.mock.calls) expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('leaves out a photo the server does not have and keeps the others', async () => {
    const fetchFn = fakeFetch((url) =>
      Promise.resolve(url.endsWith('item-2.jpg') ? new Response('not found', { status: 404 }) : jpegResponse())
    );

    const photos = await loadSamplePhotos({ fetchFn, measure });

    expect(Object.keys(photos).sort()).toEqual(['general-1', 'item-1']);
  });

  it('returns no photos when offline, without throwing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchFn = fakeFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(loadSamplePhotos({ fetchFn, measure })).resolves.toEqual({});
    expect(measure).not.toHaveBeenCalled();
  });

  it('rejects a response that is not an image, such as an HTML fallback page', async () => {
    const fetchFn = fakeFetch(() =>
      Promise.resolve(new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }))
    );

    await expect(loadSamplePhotos({ fetchFn, measure })).resolves.toEqual({});
    expect(measure).not.toHaveBeenCalled();
  });

  it('gives up on a request that does not answer in time', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchFn = fakeFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        })
    );

    const loading = loadSamplePhotos({ fetchFn, measure, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchFn.mock.calls.every(([, init]) => init?.signal?.aborted === false)).toBe(true);
    await vi.advanceTimersByTimeAsync(1);

    await expect(loading).resolves.toEqual({});
    expect(fetchFn.mock.calls.every(([, init]) => init?.signal?.aborted === true)).toBe(true);
  });

  it('gives up on a photo whose decoding does not finish in time, after the download succeeded', async () => {
    vi.useFakeTimers();
    const fetchFn = fakeFetch(() => Promise.resolve(jpegResponse()));
    const stuckMeasure = vi.fn<NonNullable<SamplePhotoDeps['measure']>>(() => new Promise(() => {}));

    const loading = loadSamplePhotos({ fetchFn, measure: stuckMeasure, timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);

    await expect(loading).resolves.toEqual({});
    expect(stuckMeasure).toHaveBeenCalledTimes(3);
  });

  it('keeps the photo without a size when its size cannot be read', async () => {
    const fetchFn = fakeFetch(() => Promise.resolve(jpegResponse()));
    const failingMeasure = vi.fn<NonNullable<SamplePhotoDeps['measure']>>(() => Promise.resolve(undefined));

    const photos = await loadSamplePhotos({ fetchFn, measure: failingMeasure });

    expect(photos['item-1']).toEqual({ dataUrl: JPEG_DATA_URL });
  });

  it('keeps the photos without a size where the browser cannot decode them (no createImageBitmap)', async () => {
    const fetchFn = fakeFetch(() => Promise.resolve(jpegResponse()));

    const photos = await loadSamplePhotos({ fetchFn });

    expect(photos['general-1']).toEqual({ dataUrl: JPEG_DATA_URL });
  });
});
