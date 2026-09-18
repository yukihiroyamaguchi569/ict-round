import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { loadRoundFile } from '../merge/loadRoundFile';
import { embedRoundExport } from '../roundExportDocx';
import type { RoundExport } from '../types';

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

describe('loadRoundFile', () => {
  it('ラウンドデータを同梱した .docx を読める', async () => {
    const roundExport = makeRoundExport();
    const docx = await embedRoundExport(await makeDocx(), roundExport);

    expect(await loadRoundFile(docx)).toEqual(roundExport);
  });

  it('旧形式の .json も読める', async () => {
    const roundExport = makeRoundExport();

    expect(await loadRoundFile(new Blob([JSON.stringify(roundExport)]))).toEqual(roundExport);
  });

  it('どちらでもないファイルは理由の分かるエラーになる', async () => {
    await expect(loadRoundFile(new Blob(['ただのテキスト']))).rejects.toThrow(
      /JSONとして読み取れません/
    );
  });
});
