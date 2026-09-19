import type { RoundExport } from '../types';
import { extractRoundExport } from '../roundExportDocx';
import { parseRoundExport } from './mergeRounds';

/** ZIP（=.docx）の先頭4バイト */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

/**
 * 1ファイルあたりのサイズ上限。
 * 写真入りの報告書でも数MB〜十数MB に収まる一方、これを大きく超えるファイルは
 * ブラウザ上での展開と写真（Base64）の保持でタブが固まるため、読む前に弾く。
 */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * 報告書の .docx（ラウンドデータ同梱）と、旧形式の .json の両方を受け付ける。
 * 拡張子は付け替えられることがあるので中身の先頭バイトで見分ける。
 */
export async function loadRoundFile(file: Blob): Promise<RoundExport> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(
      `ファイルが大きすぎます（${Math.round(file.size / 1024 / 1024)}MB）。1ファイル ${MAX_FILE_BYTES / 1024 / 1024}MB までです`
    );
  }
  const head = new Uint8Array(await file.slice(0, ZIP_SIGNATURE.length).arrayBuffer());
  const isZip = ZIP_SIGNATURE.every((byte, i) => head[i] === byte);
  return isZip ? extractRoundExport(file) : parseRoundExport(await file.text());
}
