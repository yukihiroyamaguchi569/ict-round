import JSZip from 'jszip';
import { embedRoundExport } from '../../roundExportDocx';
import type { Rating, RoundExport } from '../../types';

/** Checklist shared by every generated report: two categories, three items */
export const ROUND_CATEGORIES: RoundExport['categories'] = [
  {
    category: '手指衛生',
    items: [
      { id: 'h1', category: '手指衛生', description: '手指消毒剤が配置されている' },
      { id: 'h2', category: '手指衛生', description: '5つのタイミングが掲示されている' },
    ],
  },
  {
    category: '環境',
    items: [{ id: 'e1', category: '環境', description: 'ゴミ箱に蓋がある' }],
  },
];

/** The first category of ROUND_CATEGORIES alone: one table, two items */
export const HYGIENE_ONLY: RoundExport['categories'] = [ROUND_CATEGORIES[0]];

interface RoundOptions {
  wardName: string;
  inspectorName?: string;
  /** Rating per item ID; items not listed stay unrated */
  ratings?: Record<string, Rating>;
  /** Checklist definition; one unrated-or-rated result is made per item */
  categories?: RoundExport['categories'];
  startTime?: string;
  overallEvaluation?: string;
}

export function makeRoundExport({
  wardName,
  inspectorName = '田中',
  ratings = {},
  categories = ROUND_CATEGORIES,
  startTime = '2026-09-19 14:00',
  overallEvaluation = '',
}: RoundOptions): RoundExport {
  return {
    format: 'meguru-round',
    version: 1,
    exportedAt: '2026-09-19T00:00:00.000Z',
    checklistName: '標準チェックリスト',
    categories,
    roundData: {
      inspectorName,
      wardName,
      startTime,
      checklistResults: categories.flatMap((cat) =>
        cat.items.map((item) => ({ itemId: item.id, rating: ratings[item.id] ?? null, photos: [] }))
      ),
      generalPhotos: [],
      overallEvaluation,
    },
  };
}

/** Smallest .docx package that embedRoundExport accepts (no round data inside) */
export async function makeEmptyDocx(): Promise<Blob> {
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

/** A report .docx as the app shares it, with the round data embedded */
export async function makeRoundDocxFile(filename: string, options: RoundOptions): Promise<File> {
  const docx = await embedRoundExport(await makeEmptyDocx(), makeRoundExport(options));
  return new File([docx], filename);
}
