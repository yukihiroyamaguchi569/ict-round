import { buildFacilitySettings, type BuildSettingsResult } from './facilitySettings';

/** First four bytes of a ZIP file (= .xlsx). */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

/**
 * Size limit of a settings workbook. The template is a few KB and even a large hospital's
 * settings stay far below this, so a bigger file is not a settings file; reject it before unzipping.
 */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Reads a facility settings workbook (.xlsx) and builds the settings from its sheets.
 * Never throws: a file that cannot be read comes back as a single error without a sheet name.
 */
export async function readSettingsFile(file: File, newId: () => string): Promise<BuildSettingsResult> {
  const fileError = await checkFile(file);
  if (fileError) return fileErrorResult(fileError);
  let sheets: Record<string, string[][]>;
  try {
    sheets = await readSheets(file);
  } catch {
    return fileErrorResult('ファイルが壊れているか、Excel ファイルとして読めません。ひな形に書き込んで保存し直したファイルを選んでください');
  }
  return buildFacilitySettings(sheets, newId);
}

/** Checks extension, size and the ZIP signature; returns the message for the user, or null when the file looks readable. */
async function checkFile(file: File): Promise<string | null> {
  if (!/\.xlsx$/i.test(file.name)) {
    return 'Excel ファイル（.xlsx）を選んでください（.xls や CSV は読めません）';
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = Math.round(file.size / 1024 / 1024);
    return `ファイルが大きすぎます（${mb}MB）。施設設定のファイルは ${MAX_FILE_BYTES / 1024 / 1024}MB までです`;
  }
  // Stryker disable next-line MethodExpression: slicing only avoids reading the whole file; the first 4 bytes compared are the same either way
  const head = new Uint8Array(await file.slice(0, ZIP_SIGNATURE.length).arrayBuffer());
  if (!ZIP_SIGNATURE.every((byte, i) => head[i] === byte)) {
    return 'Excel ファイル（.xlsx）ではありません。ひな形に書き込んで .xlsx で保存したファイルを選んでください';
  }
  return null;
}

function fileErrorResult(message: string): BuildSettingsResult {
  return { ok: false, errors: [{ message }] };
}

/** Every sheet of the workbook by name, each cell as a string (empty cells as ''). */
async function readSheets(file: File): Promise<Record<string, string[][]>> {
  const { default: readXlsxFile } = await import('read-excel-file/browser');
  const workbook = await readXlsxFile(await file.arrayBuffer());
  return Object.fromEntries(
    workbook.map(({ sheet, data }) => [sheet, data.map((row) => row.map((cell) => String(cell ?? '')))])
  );
}
