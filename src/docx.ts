import {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel,
  BorderStyle, AlignmentType, Table, TableRow, TableCell, WidthType, VerticalAlign,
  ShadingType, TableLayoutType,
} from 'docx';
import type { RoundData, Photo, ChecklistCategory } from './types';
import { findItemById } from './checklistData';

export const RATING_HEX: Record<string, string> = {
  A: '059669',
  B: 'D4A017',
  C: 'DC2626',
};

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

/** 写真を3列のテーブルに並べる */
export function buildPhotoTables(entries: PhotoEntry[], clr: DocxColors): (Paragraph | Table)[] {
  const children: (Paragraph | Table)[] = [];

  for (let i = 0; i < entries.length; i += 3) {
    const rowEntries = entries.slice(i, i + 3);
    while (rowEntries.length < 3) rowEntries.push({ photo: null as unknown as Photo, label: '' });

    children.push(new Table({
      width: { size: 9026, type: WidthType.DXA },
      columnWidths: [3009, 3009, 3008],
      layout: TableLayoutType.FIXED,
      rows: [
        new TableRow({
          children: rowEntries.map((entry, idx) => {
            if (!entry.photo) {
              return new TableCell({
                width: { size: idx === 2 ? 3008 : 3009, type: WidthType.DXA },
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
              width: { size: idx === 2 ? 3008 : 3009, type: WidthType.DXA },
              children: cellChildren, verticalAlign: VerticalAlign.CENTER,
            });
          }),
        }),
      ],
    }));
    children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
  }

  return children;
}

export async function buildDocxBlob(roundData: RoundData, categories: ChecklistCategory[]): Promise<Blob> {
  const clr = getDocxColors();

  const children: (Paragraph | Table)[] = [];

  // ===== Title =====
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [new TextRun({ text: '感染対策ラウンド報告書', bold: true, size: 32, color: clr.text })],
  }));

  children.push(new Paragraph({
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
  }));

  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: clr.primary } },
    spacing: { after: 300 },
    children: [],
  }));

  // ===== Section 1: Checklist Table =====
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 160 },
    children: [new TextRun({ text: '1', bold: true, size: 26, color: clr.primary }), new TextRun({ text: '  チェックリスト', bold: true, size: 26, color: clr.text })],
  }));

  {
    const checklistRows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1300, type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: clr.primaryLt, fill: clr.primaryLt },
            children: [new Paragraph({ children: [new TextRun({ text: 'ジャンル', bold: true, size: 18, color: clr.primary })] })],
          }),
          new TableCell({
            width: { size: 7126, type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: clr.primaryLt, fill: clr.primaryLt },
            children: [new Paragraph({ children: [new TextRun({ text: 'チェック項目', bold: true, size: 18, color: clr.primary })] })],
          }),
          new TableCell({
            width: { size: 600, type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: clr.primaryLt, fill: clr.primaryLt },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '評価', bold: true, size: 18, color: clr.primary })] })],
          }),
        ],
      }),
    ];

    for (const cat of categories) {
      for (const item of cat.items) {
        const result = roundData.checklistResults.find((r) => r.itemId === item.id);
        const rating = result?.rating ?? '—';
        const ratingColor = rating !== '—' ? RATING_HEX[rating] : clr.textFaint;

        checklistRows.push(new TableRow({
          children: [
            new TableCell({
              width: { size: 1300, type: WidthType.DXA },
              shading: { type: ShadingType.SOLID, color: 'FFFFFF', fill: 'FFFFFF' },
              children: [new Paragraph({ children: [new TextRun({ text: cat.category, size: 18, color: clr.textMuted })] })],
            }),
            new TableCell({
              width: { size: 7126, type: WidthType.DXA },
              shading: { type: ShadingType.SOLID, color: 'FFFFFF', fill: 'FFFFFF' },
              children: [new Paragraph({ children: [new TextRun({ text: item.description, size: 18, color: clr.text })] })],
            }),
            new TableCell({
              width: { size: 600, type: WidthType.DXA },
              shading: { type: ShadingType.SOLID, color: 'FFFFFF', fill: 'FFFFFF' },
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: rating, bold: true, size: 22, color: ratingColor })],
              })],
            }),
          ],
        }));
      }
    }

    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [1300, 7126, 600], rows: checklistRows }));
    children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
  }

  // ===== Section 2: Photos =====
  const itemPhotosExist = roundData.checklistResults.some((r) => r.photos.length > 0);
  const generalPhotosExist = roundData.generalPhotos.length > 0;

  if (itemPhotosExist || generalPhotosExist) {
    children.push(new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: clr.line } },
      spacing: { before: 300 },
      children: [],
    }));
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 160 },
      children: [new TextRun({ text: '2', bold: true, size: 26, color: clr.primary }), new TextRun({ text: '  写真記録とICTコメント', bold: true, size: 26, color: clr.text })],
    }));

    children.push(...buildPhotoTables(collectPhotoEntries(roundData, categories), clr));
  }

  // ===== Section 3: Evaluation =====
  children.push(new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: clr.line } },
    spacing: { before: 300 },
    children: [],
  }));
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 160 },
    children: [new TextRun({ text: '3', bold: true, size: 26, color: clr.primary }), new TextRun({ text: '  総評', bold: true, size: 26, color: clr.text })],
  }));

  if (roundData.overallEvaluation.trim()) {
    const lines = roundData.overallEvaluation.split('\n');
    for (const line of lines) {
      children.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: line, size: 22, color: clr.text })],
      }));
    }
  } else {
    children.push(new Paragraph({
      children: [new TextRun({ text: '（記載なし）', size: 22, color: clr.textFaint })],
    }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBlob(doc);
}
