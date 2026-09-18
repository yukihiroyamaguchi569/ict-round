import type { RoundExport } from '../types';
import { extractRoundExport } from '../roundExportDocx';
import { parseRoundExport } from './mergeRounds';

/** ZIP（=.docx）の先頭4バイト */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

/**
 * 報告書の .docx（ラウンドデータ同梱）と、旧形式の .json の両方を受け付ける。
 * 拡張子は付け替えられることがあるので中身の先頭バイトで見分ける。
 */
export async function loadRoundFile(file: Blob): Promise<RoundExport> {
  const head = new Uint8Array(await file.slice(0, ZIP_SIGNATURE.length).arrayBuffer());
  const isZip = ZIP_SIGNATURE.every((byte, i) => head[i] === byte);
  return isZip ? extractRoundExport(file) : parseRoundExport(await file.text());
}
