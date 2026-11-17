import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { embedCustomXml, extractCustomXml, type CustomXmlPartName } from '../customXmlPart';

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default ContentType="application/xml" Extension="xml"/>' +
  '</Types>';

const DOCUMENT_RELS =
  '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

const PART_A: CustomXmlPartName = { namespace: 'urn:test:part-a', rootElement: 'partA' };
const PART_B: CustomXmlPartName = { namespace: 'urn:test:part-b', rootElement: 'partB' };

async function makeDocx(): Promise<Blob> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES);
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS);
  zip.file('word/document.xml', '<?xml version="1.0"?><document/>');
  return new Blob([await zip.generateAsync({ type: 'arraybuffer' })]);
}

async function readPart(blob: Blob, path: string): Promise<string | undefined> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file(path)?.async('string');
}

describe('embedCustomXml / extractCustomXml', () => {
  it('渡した名前空間とルート要素で埋め込み、同じ名前空間で取り出せる', async () => {
    const docx = await embedCustomXml(await makeDocx(), PART_A, '{"a":1}');

    expect(await extractCustomXml(docx, PART_A)).toBe('{"a":1}');
    const item = await readPart(docx, 'customXml/item1.xml');
    expect(item).toContain('<partA xmlns="urn:test:part-a">');
    expect(item).toMatch(/<\/partA>$/);
    expect(await readPart(docx, 'customXml/itemProps1.xml')).toContain(
      'ds:uri="urn:test:part-a"'
    );
  });

  it('2つの名前空間を同じファイルに埋め込んでも、それぞれ取り出せる', async () => {
    const withA = await embedCustomXml(await makeDocx(), PART_A, 'text-a');
    const withBoth = await embedCustomXml(withA, PART_B, 'text-b');

    expect(await extractCustomXml(withBoth, PART_A)).toBe('text-a');
    expect(await extractCustomXml(withBoth, PART_B)).toBe('text-b');
    expect(await readPart(withBoth, 'customXml/item2.xml')).toContain('<partB xmlns="urn:test:part-b">');
  });

  it('後から埋め込んだ順に関わらず、名前空間で見分ける', async () => {
    const withB = await embedCustomXml(await makeDocx(), PART_B, 'text-b');
    const withBoth = await embedCustomXml(withB, PART_A, 'text-a');

    expect(await extractCustomXml(withBoth, PART_A)).toBe('text-a');
    expect(await extractCustomXml(withBoth, PART_B)).toBe('text-b');
  });

  it('その名前空間のパートが無ければ null を返す', async () => {
    expect(await extractCustomXml(await makeDocx(), PART_A)).toBeNull();
    const withA = await embedCustomXml(await makeDocx(), PART_A, 'text-a');
    expect(await extractCustomXml(withA, PART_B)).toBeNull();
  });

  it('CDATA を閉じる ]]> を含む文字列も、そのまま往復する', async () => {
    const text = 'a]]>b]]>]]>c<![CDATA[d';
    const docx = await embedCustomXml(await makeDocx(), PART_A, text);

    expect(await extractCustomXml(docx, PART_A)).toBe(text);
  });

  it('空の文字列も往復する', async () => {
    const docx = await embedCustomXml(await makeDocx(), PART_A, '');

    expect(await extractCustomXml(docx, PART_A)).toBe('');
  });

  it('ZIP として読めないファイルは理由の分かるエラーになる', async () => {
    await expect(extractCustomXml(new Blob(['not a zip']), PART_A)).rejects.toThrow(
      'Wordファイルとして読み取れません'
    );
  });
});
