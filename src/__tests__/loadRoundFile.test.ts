import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { loadRoundFile } from '../merge/loadRoundFile';
import { embedRoundExport } from '../roundExportDocx';
import type { RoundExport } from '../types';

/** loadRoundFile.ts の上限と揃えている */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

function makeRoundExport(): RoundExport {
  return {
    format: 'meguru-round',
    version: 1,
    exportedAt: '2026-09-19T00:00:00.000Z',
    checklistName: '標準チェックリスト',
    categories: [
      { category: '環境', items: [{ id: 'i1', category: '環境', description: 'ゴミ箱に蓋がある' }] },
    ],
    roundData: {
      inspectorName: '田中',
      wardName: '5階西病棟',
      startTime: '2026-09-19 14:00',
      checklistResults: [{ itemId: 'i1', rating: 'B', photos: [] }],
      generalPhotos: [],
      overallEvaluation: '',
    },
  };
}

async function makeDocx(): Promise<Blob> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default ContentType="application/xml" Extension="xml"/></Types>'
  );
  zip.file(
    'word/_rels/document.xml.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'
  );
  return new Blob([await zip.generateAsync({ type: 'arraybuffer' })]);
}

/** 数十MBのファイルを実際に作ると重いので size だけ差し替える */
function withSize(blob: Blob, size: number): Blob {
  Object.defineProperty(blob, 'size', { value: size });
  return blob;
}

describe('loadRoundFile', () => {
  it('ラウンドデータを同梱した .docx を読める', async () => {
    const roundExport = makeRoundExport();
    const docx = await embedRoundExport(await makeDocx(), roundExport);

    expect(await loadRoundFile(docx)).toEqual(roundExport);
  });

  it('.docx でないファイルは理由の分かるエラーになる', async () => {
    await expect(loadRoundFile(new Blob(['ただのテキスト']))).rejects.toThrow(
      /Wordファイル（\.docx）ではありません/
    );
  });

  it('ラウンドデータの JSON をそのまま渡しても受け付けない', async () => {
    await expect(loadRoundFile(new Blob([JSON.stringify(makeRoundExport())]))).rejects.toThrow(
      /Wordファイル（\.docx）ではありません/
    );
  });

  it('サイズ上限を超えるファイルは理由の分かるエラーになる', async () => {
    const docx = await embedRoundExport(await makeDocx(), makeRoundExport());

    await expect(loadRoundFile(withSize(docx, MAX_FILE_BYTES + 1))).rejects.toThrow(
      /ファイルが大きすぎます/
    );
  });

  it('サイズ超過のエラーには実際の大きさと上限を MB で示す', async () => {
    const docx = await embedRoundExport(await makeDocx(), makeRoundExport());

    await expect(loadRoundFile(withSize(docx, 120 * 1024 * 1024))).rejects.toThrow(
      'ファイルが大きすぎます（120MB）。1ファイル 50MB までです'
    );
  });

  it('ZIP の署名の一部だけが一致するファイルは .docx として扱わない', async () => {
    // "PK" で始まっても 03 04 が続かなければ .docx（ZIP のローカルファイルヘッダ）ではない
    const emptyZip = new Blob([new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...new Array<number>(18).fill(0)])]);

    await expect(loadRoundFile(emptyZip)).rejects.toThrow(/Wordファイル（\.docx）ではありません/);
  });

  it('サイズ上限ちょうどのファイルは読める', async () => {
    const roundExport = makeRoundExport();
    const docx = await embedRoundExport(await makeDocx(), roundExport);

    expect(await loadRoundFile(withSize(docx, MAX_FILE_BYTES))).toEqual(roundExport);
  });
});
