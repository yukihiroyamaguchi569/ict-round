import type { FacilityRound } from './facilityRound';
import { parseStoredRound } from './storedFacilityRound';
import { isRecord, parseList } from './storedFacilitySettings';

export interface ExportedPhoto {
  id: string;
  dataUrl: string;
}

/** A round with its photo images, handed from the device that entered it to the one that makes the report. */
export interface FacilityRoundExport {
  format: 'meguru-facility-round';
  version: 1;
  /** ISO 8601. */
  exportedAt: string;
  round: FacilityRound;
  photos: ExportedPhoto[];
}

/** Photos in the order of the round's references; a reference without a stored image is left out. */
export function buildFacilityRoundExport(
  round: FacilityRound,
  photoDataUrls: Record<string, string>,
  now: Date
): FacilityRoundExport {
  const photos = round.photos.flatMap((ref) =>
    Object.hasOwn(photoDataUrls, ref.id) ? [{ id: ref.id, dataUrl: photoDataUrls[ref.id] }] : []
  );
  return { format: 'meguru-facility-round', version: 1, exportedAt: now.toISOString(), round, photos };
}

/**
 * Reads exported text back; null when it is not JSON or anything is off.
 * Images that no reference of the round points to are dropped.
 */
export function parseFacilityRoundExport(text: string): FacilityRoundExport | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.format !== 'meguru-facility-round' || value.version !== 1) return null;
  if (typeof value.exportedAt !== 'string') return null;
  const round = parseStoredRound(value.round);
  const photos = parseList(value.photos, parseExportedPhoto);
  if (!round || !photos) return null;
  const referenced = new Set(round.photos.map((p) => p.id));
  return {
    format: 'meguru-facility-round',
    version: 1,
    exportedAt: value.exportedAt,
    round,
    photos: photos.filter((p) => referenced.has(p.id)),
  };
}

function parseExportedPhoto(value: unknown): ExportedPhoto | null {
  if (!isRecord(value)) return null;
  const { id, dataUrl } = value;
  if (typeof id !== 'string' || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) return null;
  return { id, dataUrl };
}
