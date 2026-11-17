import type { RoundExport } from './types';
import { parseRoundExport } from './merge/mergeRounds';
import { embedCustomXml, extractCustomXml, type CustomXmlPartName } from './customXmlPart';

/**
 * 報告書の .docx へラウンドデータ（RoundExport）を customXml パートとして同梱する。
 * 1回の共有で1ファイルだけ渡せるようにするための仕組みで、統合ページはこのパートを読む。
 */

/** 独自パートの namespace。抽出時はこれで自分のパートを見分ける */
const ROUND_EXPORT_PART: CustomXmlPartName = {
  namespace: 'urn:meguru-round:export',
  rootElement: 'meguruRound',
};

const MISSING_ROUND_EXPORT_MESSAGE =
  'このWordファイルにはラウンドデータが入っていません。めぐる君 v1.15.0 より前に作った報告書の場合は、担当者がアプリを更新し、保存済みラウンドを開いて報告書を出し直してください。Wordで開いて保存し直したファイルの場合は、共有された元のファイルを選んでください';

/** .docx へラウンドデータを同梱した新しい .docx を返す */
export async function embedRoundExport(
  docx: Blob | ArrayBuffer,
  roundExport: RoundExport
): Promise<Blob> {
  return embedCustomXml(docx, ROUND_EXPORT_PART, JSON.stringify(roundExport));
}

/** .docx に同梱されたラウンドデータを取り出して検証する */
export async function extractRoundExport(docx: Blob | ArrayBuffer): Promise<RoundExport> {
  const text = await extractCustomXml(docx, ROUND_EXPORT_PART);
  if (text === null) throw new Error(MISSING_ROUND_EXPORT_MESSAGE);
  return parseRoundExport(text);
}
