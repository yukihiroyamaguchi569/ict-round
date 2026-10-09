import {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel,
  BorderStyle, AlignmentType, Table, TableRow, TableCell, WidthType, VerticalAlign,
  ShadingType, TableLayoutType,
} from 'docx';
import type { RoundData, Photo, ChecklistCategory, Rating } from './types';
import { findItemById } from './checklistData';

export const RATING_HEX: Record<string, string> = {
  A: '059669',
  B: 'D4A017',
  C: 'DC2626',
};

/** Report heading; the sample report is marked so it is never mistaken for a real one. */
export function reportTitle(isSample: boolean): string {
  return `${isSample ? '【サンプル】' : ''}感染対策ラウンド報告書`;
}

export function getCssHex(varName: string): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  const hex = raw.replace('#', '');
  return /^[0-9a-fA-F]{6}$/.test(hex) ? hex : 'CCCCCC';
}

export function fitContain(w?: number, h?: number, frame = 150): { width: number; height: number } {
  if (!w || !h) return { width: 148, height: 111 };
  const scale = Math.min(frame / w, frame / h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

export function base64ToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let j = 0; j < binaryStr.length; j++) {
    bytes[j] = binaryStr.charCodeAt(j);
  }
  return bytes;
}

export interface DocxColors {
  primary: string;
  primaryLt: string;
  base: string;
  text: string;
  textMuted: string;
  textFaint: string;
  line: string;
}

export function getDocxColors(): DocxColors {
  return {
    primary:    getCssHex('--t-primary'),
    primaryLt:  getCssHex('--t-primary-light'),
    base:       getCssHex('--t-base'),
    text:       getCssHex('--t-text'),
    textMuted:  getCssHex('--t-text-muted'),
    textFaint:  getCssHex('--t-text-faint'),
    line:       getCssHex('--t-line'),
  };
}

export interface PhotoEntry {
  photo: Photo;
  label: string;
}

/** 項目に紐づいた写真 → 全体写真 の順に並べる */
export function collectPhotoEntries(roundData: RoundData, categories: ChecklistCategory[]): PhotoEntry[] {
  const entries: PhotoEntry[] = [];
  for (const result of roundData.checklistResults) {
    if (result.photos.length === 0) continue;
    const item = findItemById(categories, result.itemId);
    for (const photo of result.photos) {
      entries.push({ photo, label: `${item?.category ?? ''}: ${item?.description?.slice(0, 20) ?? ''}` });
    }
  }
  for (const photo of roundData.generalPhotos) {
    entries.push({ photo, label: '' });
  }
  return entries;
}

/** 写真表の列幅（合計が本文幅 9026） */
const PHOTO_COL_WIDTHS = [3009, 3009, 3008];

/** 写真表の1セル。写真が無いセルは3列に揃えるための空セル */
function photoCell(entry: PhotoEntry | undefined, width: number, clr: DocxColors): TableCell {
  if (!entry) {
    return new TableCell({
      width: { size: width, type: WidthType.DXA },
      children: [new Paragraph({ children: [] })],
    });
  }
  const cellChildren: Paragraph[] = [
    new Paragraph({ spacing: { after: 40 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: entry.label, size: 16, bold: true, color: clr.primary })] }),
  ];
  try {
    cellChildren.push(new Paragraph({
      spacing: { after: 40 },
      alignment: AlignmentType.CENTER, children: [new ImageRun({ data: base64ToUint8Array(entry.photo.dataUrl), transformation: fitContain(entry.photo.width, entry.photo.height), type: 'jpg' })],
    }));
  } catch { /* skip */ }
  if (entry.photo.comment) {
    cellChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: entry.photo.comment, size: 16 })] }));
  }
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    children: cellChildren, verticalAlign: VerticalAlign.CENTER,
  });
}

/** 写真を3列のテーブルに並べる */
export function buildPhotoTables(entries: PhotoEntry[], clr: DocxColors): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];

  for (let i = 0; i < entries.length; i += 3) {
    children.push(new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: PHOTO_COL_WIDTHS,
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          children: PHOTO_COL_WIDTHS.map((width, idx) => photoCell(entries[i + idx], width, clr)),
        }),
      ],
    }));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
  }

  return children;
}

/** 番号付きの節見出し */
function sectionHeading(num: string, title: string, clr: DocxColors): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 160 },
    children: [new TextRun({ text: num, bold: true, size: 26, color: clr.primary }), new TextRun({ text: `  ${title}`, bold: true, size: 26, color: clr.text })],
  });
}

/** 節の前に引く区切り線 */
function sectionDivider(clr: DocxColors): Paragraph {
  return new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: clr.line } },
    spacing: { before: 300 },
    children: [],
  });
}

/** 表題と、担当者・病棟・実施日時。サンプルは表題に【サンプル】を付ける */
export function buildCoverSection(roundData: RoundData, clr: DocxColors, isSample = false): Paragraph[] {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: reportTitle(isSample), bold: true, size: 32, color: clr.text })],
    }),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: '担当者: ', bold: true, color: clr.textMuted }),
        new TextRun({ text: roundData.inspectorName, color: clr.text }),
        new TextRun('　'),
        new TextRun({ text: '病棟: ', bold: true, color: clr.textMuted }),
        new TextRun({ text: roundData.wardName || '—', color: clr.text }),
        new TextRun('　'),
        new TextRun({ text: '実施日時: ', bold: true, color: clr.textMuted }),
        new TextRun({ text: roundData.startTime, color: clr.text }),
      ],
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: clr.primary } },
      spacing: { after: 300 },
      children: [],
    }),
  ];
}

/** チェックリスト表の列幅（ジャンル・チェック項目・評価） */
const CHECKLIST_COL_WIDTHS = [1300, 7126, 600];

function checklistHeaderCell(text: string, width: number, clr: DocxColors, center = false): TableCell {
  const run = new TextRun({ text, bold: true, size: 18, color: clr.primary });
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: clr.primaryLt, fill: clr.primaryLt },
    children: [new Paragraph(center ? { alignment: AlignmentType.CENTER, children: [run] } : { children: [run] })],
  });
}

function checklistBodyCell(width: number, paragraph: Paragraph): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: 'FFFFFF', fill: 'FFFFFF' },
    children: [paragraph],
  });
}

/** チェックリスト表の1行。未評価の項目は「—」を薄い色で出す */
function checklistRow(categoryName: string, description: string, rating: Rating | undefined, clr: DocxColors): TableRow {
  const text = rating ?? '—';
  const ratingColor = rating ? RATING_HEX[rating] : clr.textFaint;
  const [catW, itemW, ratingW] = CHECKLIST_COL_WIDTHS;
  return new TableRow({
    children: [
      checklistBodyCell(catW, new Paragraph({ children: [new TextRun({ text: categoryName, size: 18, color: clr.textMuted })] })),
      checklistBodyCell(itemW, new Paragraph({ children: [new TextRun({ text: description, size: 18, color: clr.text })] })),
      checklistBodyCell(ratingW, new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, size: 22, color: ratingColor })],
      })),
    ],
  });
}

/** 1. チェックリスト: 全項目と評価の表 */
export function buildChecklistSection(roundData: RoundData, categories: ChecklistCategory[], clr: DocxColors): (Paragraph | Table)[] {
  const [catW, itemW, ratingW] = CHECKLIST_COL_WIDTHS;
  const header = new TableRow({
    children: [
      checklistHeaderCell('ジャンル', catW, clr),
      checklistHeaderCell('チェック項目', itemW, clr),
      checklistHeaderCell('評価', ratingW, clr, true),
    ],
  });
  const rows = categories.flatMap((cat) =>
    cat.items.map((item) => {
      const result = roundData.checklistResults.find((r) => r.itemId === item.id);
      return checklistRow(cat.category, item.description, result?.rating, clr);
    }),
  );
  return [
    sectionHeading('1', 'チェックリスト', clr),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: CHECKLIST_COL_WIDTHS, rows: [header, ...rows] }),
    new Paragraph({ spacing: { after: 160 }, children: [] }),
  ];
}

/** 2. 写真記録とICTコメント: 写真が1枚も無ければ節ごと出さない */
export function buildPhotoSection(roundData: RoundData, categories: ChecklistCategory[], clr: DocxColors): (Paragraph | Table)[] {
  const itemPhotosExist = roundData.checklistResults.some((r) => r.photos.length > 0);
  const generalPhotosExist = roundData.generalPhotos.length > 0;
  if (!itemPhotosExist && !generalPhotosExist) return [];
  return [
    sectionDivider(clr),
    sectionHeading('2', '写真記録とICTコメント', clr),
    ...buildPhotoTables(collectPhotoEntries(roundData, categories), clr),
  ];
}

/** 3. 総評: 行ごとに段落にする */
export function buildEvaluationSection(overallEvaluation: string, clr: DocxColors): Paragraph[] {
  const body = overallEvaluation.trim()
    ? overallEvaluation.split('\n').map((line) => new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: line, size: 22, color: clr.text })],
    }))
    // 未記載の総評は、出力後に Word で書き込めるよう空の段落を1つ置く
    : [new Paragraph({ spacing: { after: 80 }, children: [] })];
  return [sectionDivider(clr), sectionHeading('3', '総評', clr), ...body];
}

export async function buildDocxBlob(roundData: RoundData, categories: ChecklistCategory[], isSample = false): Promise<Blob> {
  const clr = getDocxColors();
  const children: (Paragraph | Table)[] = [
    ...buildCoverSection(roundData, clr, isSample),
    ...buildChecklistSection(roundData, categories, clr),
    ...buildPhotoSection(roundData, categories, clr),
    ...buildEvaluationSection(roundData.overallEvaluation, clr),
  ];
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}
