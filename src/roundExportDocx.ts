import JSZip from 'jszip';
import type { RoundExport } from './types';
import { parseRoundExport } from './merge/mergeRounds';

/**
 * 報告書の .docx へラウンドデータ（RoundExport）を customXml パートとして同梱する。
 * 1回の共有で1ファイルだけ渡せるようにするための仕組みで、統合ページはこのパートを読む。
 * Word が開き直して保存しても残るよう、itemProps とリレーションを揃えた正規の形で書き込む。
 */

/** 独自パートの namespace。抽出時はこれで自分のパートを見分ける */
const ROUND_EXPORT_NS = 'urn:meguru-round:export';

const CUSTOM_XML_REL_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml';
const CUSTOM_XML_PROPS_REL_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps';
const CUSTOM_XML_PROPS_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.customXmlProperties+xml';

const CONTENT_TYPES_PATH = '[Content_Types].xml';
const DOCUMENT_RELS_PATH = 'word/_rels/document.xml.rels';

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export const MISSING_ROUND_EXPORT_MESSAGE =
  'このWordファイルにはラウンドデータが入っていません。めぐる君 v1.15.0 より前に作った報告書の場合は、担当者がアプリを更新し、保存済みラウンドを開いて報告書を出し直してください。Wordで開いて保存し直したファイルの場合は、共有された元のファイルを選んでください';

/** CDATA を途中で閉じてしまう `]]>` を、CDATA を分割して無害化する */
function escapeCdata(text: string): string {
  return text.split(']]>').join(']]]]><![CDATA[>');
}

/** CDATA セクションを順に連結する。escapeCdata の逆変換になる */
function readCdata(xml: string): string {
  let text = '';
  for (const match of xml.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)) text += match[1];
  return text;
}

/** 既存の customXml と衝突しない item 番号を探す */
function findFreeItemNumber(zip: JSZip): number {
  // item 本体が無くても itemProps やリレーションだけが残っていることがあるため、
  // 3つのいずれかが存在する番号は使用済みとして避ける
  const isUsed = (n: number) =>
    zip.file(`customXml/item${n}.xml`) ||
    zip.file(`customXml/itemProps${n}.xml`) ||
    zip.file(`customXml/_rels/item${n}.xml.rels`);
  let n = 1;
  while (isUsed(n)) n++;
  return n;
}

/** Word が ds:itemID に使う `{XXXXXXXX-...}` 形式 */
function newItemId(): string {
  return `{${crypto.randomUUID().toUpperCase()}}`;
}

async function readPart(zip: JSZip, path: string): Promise<string> {
  const part = zip.file(path);
  if (!part) throw new Error(`Wordファイルの構造が想定と違います（${path} がありません）`);
  return part.async('string');
}

/** itemProps の Override と、拡張子 xml の Default を足す */
function addContentTypes(xml: string, itemNumber: number): string {
  let next = xml;
  if (!/<Default\b[^>]*Extension="xml"/.test(next)) {
    next = next.replace(
      /(<Types\b[^>]*>)/,
      '$1<Default ContentType="application/xml" Extension="xml"/>'
    );
  }
  return next.replace(
    '</Types>',
    `<Override ContentType="${CUSTOM_XML_PROPS_CONTENT_TYPE}" PartName="/customXml/itemProps${itemNumber}.xml"/></Types>`
  );
}

/** document.xml.rels へ customXml へのリレーションを足す。rId は既存の最大値+1 で衝突を避ける */
function addCustomXmlRelationship(xml: string, itemNumber: number): string {
  const usedNumbers = [...xml.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  const id = `rId${Math.max(0, ...usedNumbers) + 1}`;
  return xml.replace(
    '</Relationships>',
    `<Relationship Id="${id}" Type="${CUSTOM_XML_REL_TYPE}" Target="../customXml/item${itemNumber}.xml"/></Relationships>`
  );
}

/** .docx へラウンドデータを同梱した新しい .docx を返す */
export async function embedRoundExport(
  docx: Blob | ArrayBuffer,
  roundExport: RoundExport
): Promise<Blob> {
  const zip = await JSZip.loadAsync(docx);
  const n = findFreeItemNumber(zip);

  const json = escapeCdata(JSON.stringify(roundExport));
  zip.file(
    `customXml/item${n}.xml`,
    `${XML_DECL}<meguruRound xmlns="${ROUND_EXPORT_NS}"><![CDATA[${json}]]></meguruRound>`
  );
  zip.file(
    `customXml/itemProps${n}.xml`,
    `${XML_DECL}<ds:datastoreItem ds:itemID="${newItemId()}" xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"><ds:schemaRefs><ds:schemaRef ds:uri="${ROUND_EXPORT_NS}"/></ds:schemaRefs></ds:datastoreItem>`
  );
  zip.file(
    `customXml/_rels/item${n}.xml.rels`,
    `${XML_DECL}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${CUSTOM_XML_PROPS_REL_TYPE}" Target="itemProps${n}.xml"/></Relationships>`
  );

  zip.file(CONTENT_TYPES_PATH, addContentTypes(await readPart(zip, CONTENT_TYPES_PATH), n));
  zip.file(DOCUMENT_RELS_PATH, addCustomXmlRelationship(await readPart(zip, DOCUMENT_RELS_PATH), n));

  // 再圧縮しないと写真入りの報告書が数倍に膨らむ
  const buffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  return new Blob([buffer]);
}

/** .docx に同梱されたラウンドデータを取り出して検証する */
export async function extractRoundExport(docx: Blob | ArrayBuffer): Promise<RoundExport> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(docx);
  } catch {
    throw new Error('Wordファイルとして読み取れません（ファイルが壊れている可能性があります）');
  }

  for (const path of Object.keys(zip.files)) {
    if (!/^customXml\/item\d+\.xml$/.test(path)) continue;
    const xml = await zip.files[path].async('string');
    if (!xml.includes(ROUND_EXPORT_NS)) continue;
    return parseRoundExport(readCdata(xml));
  }
  throw new Error(MISSING_ROUND_EXPORT_MESSAGE);
}
