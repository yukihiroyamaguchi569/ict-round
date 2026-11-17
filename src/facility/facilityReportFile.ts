import { embedCustomXml, extractCustomXml, type CustomXmlPartName } from '../customXmlPart';
import { parseFacilityRoundExport, type FacilityRoundExport } from './facilityRoundExport';

/** Separate from the main app's report part (urn:meguru-round:export), so the two never mix. */
const FACILITY_ROUND_PART: CustomXmlPartName = {
  namespace: 'urn:meguru-facility-round:export',
  rootElement: 'meguruFacilityRound',
};

/** First four bytes of a ZIP file (= .docx). */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

/** Same limit as the merge page's report files: bigger files freeze the tab while unzipping. */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

export type LoadFacilityRoundResult =
  | { ok: true; export: FacilityRoundExport }
  | { ok: false; reason: 'too-large' | 'not-docx' | 'no-round-data' };

/** The report .docx with the round data embedded as a customXml part. */
export async function embedFacilityRoundExport(
  docx: Blob | ArrayBuffer,
  exportData: FacilityRoundExport
): Promise<Blob> {
  return embedCustomXml(docx, FACILITY_ROUND_PART, JSON.stringify(exportData));
}

/** The embedded round data; null when there is none or it is malformed. Throws when the file is not a ZIP. */
export async function extractFacilityRoundExport(docx: Blob | ArrayBuffer): Promise<FacilityRoundExport | null> {
  const text = await extractCustomXml(docx, FACILITY_ROUND_PART);
  return text === null ? null : parseFacilityRoundExport(text);
}

/** Reads a report file handed from another device; never throws. */
export async function loadFacilityRoundFile(file: Blob): Promise<LoadFacilityRoundResult> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: 'too-large' };
  try {
    // Stryker disable next-line MethodExpression: slicing only avoids reading the whole file; the first 4 bytes compared are the same either way
    const head = new Uint8Array(await file.slice(0, ZIP_SIGNATURE.length).arrayBuffer());
    if (!ZIP_SIGNATURE.every((byte, i) => head[i] === byte)) return { ok: false, reason: 'not-docx' };
    const exportData = await extractFacilityRoundExport(file);
    return exportData ? { ok: true, export: exportData } : { ok: false, reason: 'no-round-data' };
  } catch {
    return { ok: false, reason: 'not-docx' };
  }
}
