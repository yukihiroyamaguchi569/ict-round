import JSZip from 'jszip';

/**
 * .docx に独自データを customXml パートとして同梱し、取り出す。
 * 名前空間で自分のパートを見分けるので、別の名前空間のパートと同じファイルに共存できる。
 * Word が開き直して保存しても残るよう、itemProps とリレーションを揃えた正規の形で書き込む。
 */

/** パートの見分けに使う名前空間と、item 本体のルート要素名 */
export type CustomXmlPartName = { namespace: string; rootElement: string };

const CUSTOM_XML_REL_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml';
const CUSTOM_XML_PROPS_REL_TYPE =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXmlProps';
const CUSTOM_XML_PROPS_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.customXmlProperties+xml';

const CONTENT_TYPES_PATH = '[Content_Types].xml';
const DOCUMENT_RELS_PATH = 'word/_rels/document.xml.rels';

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

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

/** .docx へ文字列を customXml パートとして同梱した新しい .docx を返す */
export async function embedCustomXml(
  docx: Blob | ArrayBuffer,
  { namespace, rootElement }: CustomXmlPartName,
  text: string
): Promise<Blob> {
  const zip = await JSZip.loadAsync(docx);
  const n = findFreeItemNumber(zip);

  zip.file(
    `customXml/item${n}.xml`,
    `${XML_DECL}<${rootElement} xmlns="${namespace}"><![CDATA[${escapeCdata(text)}]]></${rootElement}>`
  );
  zip.file(
    `customXml/itemProps${n}.xml`,
    `${XML_DECL}<ds:datastoreItem ds:itemID="${newItemId()}" xmlns:ds="http://schemas.openxmlformats.org/officeDocument/2006/customXml"><ds:schemaRefs><ds:schemaRef ds:uri="${namespace}"/></ds:schemaRefs></ds:datastoreItem>`
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

/**
 * .docx から、名前空間が一致する customXml パートの文字列を取り出す。
 * 該当するパートが無ければ null。ZIP として読めなければ例外を投げる
 */
export async function extractCustomXml(
  docx: Blob | ArrayBuffer,
  { namespace }: CustomXmlPartName
): Promise<string | null> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(docx);
  } catch {
    throw new Error('Wordファイルとして読み取れません（ファイルが壊れている可能性があります）');
  }

  for (const path of Object.keys(zip.files)) {
    if (!/^customXml\/item\d+\.xml$/.test(path)) continue;
    const xml = await zip.files[path].async('string');
    if (!xml.includes(namespace)) continue;
    return readCdata(xml);
  }
  return null;
}
