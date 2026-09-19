import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { embedRoundExport, extractRoundExport } from '../roundExportDocx';
import { parseRoundExport } from '../merge/mergeRounds';
import type { RoundExport } from '../types';

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default ContentType="application/vnd.openxmlformats-package.relationships+xml" Extension="rels"/>' +
  '<Default ContentType="application/xml" Extension="xml"/>' +
  '<Override ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" PartName="/word/document.xml"/>' +
  '</Types>';

const DOCUMENT_RELS =
  '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

/** docx ライブラリの出力を模した最小の .docx */
async function makeDocx(extraParts: Record<string, string> = {}): Promise<Blob> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS);
  zip.file('word/document.xml', '<?xml version="1.0"?><document/>');
  for (const [path, content] of Object.entries(extraParts)) zip.file(path, content);
  return new Blob([await zip.generateAsync({ type: 'arraybuffer' })]);
}

function makeRoundExport(): RoundExport {
  return {
    format: 'meguru-round',
    version: 1,
    exportedAt: '2026-09-19T00:00:00.000Z',
    checklistName: '標準チェックリスト',
    categories: [
      { category: '手指衛生', items: [{ id: 'i1', category: '手指衛生', description: '擦式消毒薬がある' }] },
    ],
    roundData: {
      inspectorName: '山口',
      wardName: '3階東病棟',
      startTime: '2026-09-19 10:00',
      checklistResults: [{ itemId: 'i1', rating: 'A', photos: [] }],
      generalPhotos: [],
      overallEvaluation: '良好',
    },
  };
}

async function readPart(blob: Blob, path: string): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const part = zip.file(path);
  if (!part) throw new Error(`パートがありません: ${path}`);
  return part.async('string');
}

async function hasPart(blob: Blob, path: string): Promise<boolean> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file(path) !== null;
}

describe('embedRoundExport / extractRoundExport', () => {
  it('埋め込んだラウンドデータをそのまま取り出せる', async () => {
    const roundExport = makeRoundExport();
    const embedded = await embedRoundExport(await makeDocx(), roundExport);

    expect(await extractRoundExport(embedded)).toEqual(roundExport);
  });

  it('CDATA を閉じる文字列が入っていても壊れない', async () => {
    const roundExport = makeRoundExport();
    roundExport.roundData.overallEvaluation = 'カルテの記載 ]]> が残っていた <tag> & "quote"';
    const embedded = await embedRoundExport(await makeDocx(), roundExport);

    expect((await extractRoundExport(embedded)).roundData.overallEvaluation).toBe(
      roundExport.roundData.overallEvaluation
    );
  });

  it('[Content_Types].xml と document.xml.rels に登録される', async () => {
    const embedded = await embedRoundExport(await makeDocx(), makeRoundExport());

    const contentTypes = await readPart(embedded, '[Content_Types].xml');
    expect(contentTypes).toContain(
      '<Override ContentType="application/vnd.openxmlformats-officedocument.customXmlProperties+xml" PartName="/customXml/itemProps1.xml"/>'
    );
    expect(contentTypes).toContain('<Default ContentType="application/xml" Extension="xml"/>');
    expect(contentTypes.endsWith('</Types>')).toBe(true);

    const rels = await readPart(embedded, 'word/_rels/document.xml.rels');
    expect(rels).toContain(
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml" Target="../customXml/item1.xml"/>'
    );

    expect(await readPart(embedded, 'customXml/_rels/item1.xml.rels')).toContain(
      'Target="itemProps1.xml"'
    );
    expect(await readPart(embedded, 'customXml/itemProps1.xml')).toMatch(
      /ds:itemID="\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}"/
    );
  });

  it('拡張子 xml の Default が無い .docx にも Default を足す', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', CONTENT_TYPES.replace('<Default ContentType="application/xml" Extension="xml"/>', ''));
    zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS);
    const base = new Blob([await zip.generateAsync({ type: 'arraybuffer' })]);

    const contentTypes = await readPart(await embedRoundExport(base, makeRoundExport()), '[Content_Types].xml');
    expect(contentTypes).toContain('<Default ContentType="application/xml" Extension="xml"/>');
  });

  it('既に customXml を持つ .docx では空き番号を使い、既存パートを壊さない', async () => {
    const existing = '<?xml version="1.0"?><otherApp>keep me</otherApp>';
    const base = await makeDocx({
      'customXml/item1.xml': existing,
      'customXml/itemProps1.xml': '<?xml version="1.0"?><ds:datastoreItem xmlns:ds="x"/>',
    });

    const embedded = await embedRoundExport(base, makeRoundExport());

    expect(await readPart(embedded, 'customXml/item1.xml')).toBe(existing);
    expect(await hasPart(embedded, 'customXml/item2.xml')).toBe(true);
    expect(await extractRoundExport(embedded)).toEqual(makeRoundExport());
  });

  it('itemProps だけが残っている .docx でも既存パートを壊さない', async () => {
    const existingProps = '<?xml version="1.0"?><ds:datastoreItem xmlns:ds="x">keep me</ds:datastoreItem>';
    const base = await makeDocx({ 'customXml/itemProps1.xml': existingProps });

    const embedded = await embedRoundExport(base, makeRoundExport());

    expect(await readPart(embedded, 'customXml/itemProps1.xml')).toBe(existingProps);
    expect(await hasPart(embedded, 'customXml/item2.xml')).toBe(true);
    expect(await extractRoundExport(embedded)).toEqual(makeRoundExport());
  });

  it('リレーションだけが残っている .docx でも既存パートを壊さない', async () => {
    const existingRels = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">keep me</Relationships>';
    const base = await makeDocx({ 'customXml/_rels/item1.xml.rels': existingRels });

    const embedded = await embedRoundExport(base, makeRoundExport());

    expect(await readPart(embedded, 'customXml/_rels/item1.xml.rels')).toBe(existingRels);
    expect(await readPart(embedded, 'customXml/_rels/item2.xml.rels')).toContain(
      'Target="itemProps2.xml"'
    );
    expect(await extractRoundExport(embedded)).toEqual(makeRoundExport());
  });

  it('ラウンドデータの無い .docx は理由の分かるエラーになる', async () => {
    await expect(extractRoundExport(await makeDocx())).rejects.toThrow(
      /ラウンドデータが入っていません/
    );
  });

  it('.docx として読めないファイルは理由の分かるエラーになる', async () => {
    await expect(extractRoundExport(new Blob(['not a zip']))).rejects.toThrow(
      /Wordファイルとして読み取れません/
    );
  });
});

/** roundData から指定フィールドを落とした JSON 文字列 */
function jsonWithoutRoundDataField(field: string): string {
  const roundExport = makeRoundExport();
  const roundData: Record<string, unknown> = { ...roundExport.roundData };
  delete roundData[field];
  return JSON.stringify({ ...roundExport, roundData });
}

describe('parseRoundExport', () => {
  it('壊れた JSON を弾く', () => {
    expect(() => parseRoundExport('{ broken')).toThrow(/JSONとして読み取れません/);
  });

  it('format が違うものを弾く', () => {
    expect(() => parseRoundExport(JSON.stringify({ format: 'other', version: 1 }))).toThrow(
      /めぐる君のラウンドデータではありません/
    );
  });

  it('version が違うものを弾く', () => {
    expect(() => parseRoundExport(JSON.stringify({ ...makeRoundExport(), version: 2 }))).toThrow(
      /未対応のバージョンです（version: 2）/
    );
  });

  it('roundData が欠けているものを弾く', () => {
    expect(() =>
      parseRoundExport(JSON.stringify({ format: 'meguru-round', version: 1, categories: [] }))
    ).toThrow(/形式が壊れています/);
  });

  it('妥当なデータはそのまま通す', () => {
    const roundExport = makeRoundExport();

    expect(parseRoundExport(JSON.stringify(roundExport))).toEqual(roundExport);
  });

  it('省略可能な checklistName が無い roundData も通す', () => {
    const roundExport = makeRoundExport();
    delete roundExport.roundData.checklistName;

    expect(parseRoundExport(JSON.stringify(roundExport))).toEqual(roundExport);
  });

  it('部署名が欠けているものを「どこが」付きで弾く', () => {
    expect(() => parseRoundExport(jsonWithoutRoundDataField('wardName'))).toThrow(
      /形式が壊れています（部署名）/
    );
  });

  it('総評が欠けているものを弾く', () => {
    expect(() => parseRoundExport(jsonWithoutRoundDataField('overallEvaluation'))).toThrow(
      /形式が壊れています（総評）/
    );
  });

  it('roundData が配列のものを弾く', () => {
    expect(() =>
      parseRoundExport(JSON.stringify({ ...makeRoundExport(), roundData: [] }))
    ).toThrow(/形式が壊れています（ラウンドの内容）/);
  });

  it('評価が A/B/C/null 以外のものを弾く', () => {
    const roundExport = makeRoundExport();
    const results: unknown[] = [{ itemId: 'i1', rating: 'D', photos: [] }];

    expect(() =>
      parseRoundExport(JSON.stringify({ ...roundExport, roundData: { ...roundExport.roundData, checklistResults: results } }))
    ).toThrow(/形式が壊れています（チェック結果1の評価）/);
  });

  it('評価が null のチェック結果は通す', () => {
    const roundExport = makeRoundExport();
    roundExport.roundData.checklistResults = [{ itemId: 'i1', rating: null, photos: [] }];

    expect(parseRoundExport(JSON.stringify(roundExport))).toEqual(roundExport);
  });

  it('写真が配列でないチェック結果を弾く', () => {
    const roundExport = makeRoundExport();
    const results: unknown[] = [{ itemId: 'i1', rating: 'A', photos: null }];

    expect(() =>
      parseRoundExport(JSON.stringify({ ...roundExport, roundData: { ...roundExport.roundData, checklistResults: results } }))
    ).toThrow(/形式が壊れています（チェック結果1の写真）/);
  });

  it('カテゴリの中の項目が壊れているものを弾く', () => {
    const categories: unknown[] = [
      { category: '手指衛生', items: [{ id: 1, description: '擦式消毒薬がある' }] },
    ];

    expect(() => parseRoundExport(JSON.stringify({ ...makeRoundExport(), categories }))).toThrow(
      /形式が壊れています（カテゴリ1の項目1のID）/
    );
  });

  it('カテゴリの items が配列でないものを弾く', () => {
    const categories: unknown[] = [{ category: '手指衛生', items: null }];

    expect(() => parseRoundExport(JSON.stringify({ ...makeRoundExport(), categories }))).toThrow(
      /形式が壊れています（カテゴリ1の項目一覧）/
    );
  });

  it('categories が配列でないものを弾く', () => {
    expect(() =>
      parseRoundExport(JSON.stringify({ ...makeRoundExport(), categories: {} }))
    ).toThrow(/形式が壊れています（カテゴリ一覧）/);
  });

  it('チェック結果が配列でないものを弾く', () => {
    const roundExport = makeRoundExport();

    expect(() =>
      parseRoundExport(JSON.stringify({ ...roundExport, roundData: { ...roundExport.roundData, checklistResults: 'none' } }))
    ).toThrow(/形式が壊れています（チェック結果）/);
  });

  it('全体の写真が欠けているものを弾く', () => {
    expect(() => parseRoundExport(jsonWithoutRoundDataField('generalPhotos'))).toThrow(
      /形式が壊れています（全体の写真）/
    );
  });

  it('JSON が配列やスカラーのものを弾く', () => {
    expect(() => parseRoundExport('[]')).toThrow(/JSONの中身が空です/);
    expect(() => parseRoundExport('null')).toThrow(/JSONの中身が空です/);
    expect(() => parseRoundExport('"text"')).toThrow(/JSONの中身が空です/);
  });
});
