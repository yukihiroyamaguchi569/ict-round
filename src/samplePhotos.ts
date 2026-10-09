import type { ImageSize } from './photoImage';
import { SAMPLE_PHOTOS, type SamplePhotoImage, type SamplePhotoImages } from './sampleRound';

/** Long enough for three small JPEGs on a slow connection; normally they come from the Service Worker cache. */
const FETCH_TIMEOUT_MS = 8000;

export interface SamplePhotoDeps {
  fetchFn?: (input: string, init?: RequestInit) => Promise<Response>;
  /** Decodes an image and reads its pixel size; undefined when it cannot be decoded. */
  measure?: (blob: Blob) => Promise<ImageSize | undefined>;
  baseUrl?: string;
  timeoutMs?: number;
}

async function measureWithBitmap(blob: Blob): Promise<ImageSize | undefined> {
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return undefined;
  }
}

async function toDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

/** One bundled photo, or null when it cannot be fetched or is not a decodable JPEG. */
async function fetchImage(
  url: string,
  fetchFn: NonNullable<SamplePhotoDeps['fetchFn']>,
  measure: NonNullable<SamplePhotoDeps['measure']>,
  signal: AbortSignal
): Promise<SamplePhotoImage | null> {
  try {
    const response = await fetchFn(url, { signal });
    if (!response.ok) return null;
    const blob = await response.blob();
    // A missing file may come back as the HTML fallback page with status 200, and the report embeds photos as JPEG
    if (blob.type !== 'image/jpeg') return null;
    // A photo the browser cannot decode would show broken in the preview and the report
    const size = await measure(blob);
    if (!size) return null;
    return { dataUrl: await toDataUrl(blob), ...size };
  } catch (err) {
    console.warn('サンプル写真を読み込めませんでした:', url, err);
    return null;
  }
}

/** fetchImage with a deadline over the whole photo (download and decoding); null once it passes. */
async function loadOne(
  url: string,
  fetchFn: NonNullable<SamplePhotoDeps['fetchFn']>,
  measure: NonNullable<SamplePhotoDeps['measure']>,
  timeoutMs: number
): Promise<SamplePhotoImage | null> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  try {
    return await Promise.race([fetchImage(url, fetchFn, measure, controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches the sample photos bundled under public/sample/ as data URLs.
 * Never throws: a photo that cannot be loaded is left out, so the sample still starts.
 */
export async function loadSamplePhotos({
  fetchFn = (input, init) => fetch(input, init),
  measure = measureWithBitmap,
  baseUrl = import.meta.env.BASE_URL,
  timeoutMs = FETCH_TIMEOUT_MS,
}: SamplePhotoDeps = {}): Promise<SamplePhotoImages> {
  const loaded = await Promise.all(
    SAMPLE_PHOTOS.map(async (def) => [def.key, await loadOne(`${baseUrl}${def.file}`, fetchFn, measure, timeoutMs)] as const)
  );
  const images: SamplePhotoImages = {};
  for (const [key, image] of loaded) {
    if (image) images[key] = image;
  }
  return images;
}
