import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  BorderStyle, AlignmentType, Table, TableRow, TableCell, WidthType,
  ShadingType, TableLayoutType, PageOrientation,
} from 'docx';
import {
  RATING_HEX, getDocxColors, buildPhotoTables, collectPhotoEntries,
  type DocxColors,
} from '../docx';
import type { MergeResult, DeptColumn } from './mergeRounds';

// A4横（16838 twips）から左右余白 1440×2 を引いた本文幅
const CONTENT_W = 13958;
const DEPT_COL_W = 900;

function headerCell(text: string, width: number, clr: DocxColors, center = false): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: { type: ShadingType.SOLID, color: clr.primaryLt, fill: clr.primaryLt },
    children: [new Paragraph({
      alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text, bold: true, size: 18, color: clr.primary })],
    })],
  });
}

/** 部署を列とする評価マトリクスの docx を作る */
export async function buildMergedDocxBlob(merged: MergeResult): Promise<Blob> {
  const clr = getDocxColors();
  const { columns, categories } = merged;
  const itemColW = Math.max(2000, CONTENT_W - DEPT_COL_W * columns.length);
  const columnWidths = [itemColW, ...columns.map(() => DEPT_COL_W)];

  const children: (Paragraph | Table)[] = [];

  // ===== Title =====
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [new TextRun({ text: '感染対策ラウンド報告書（統合）', bold: true, size: 32, color: clr.text })],
  }));

  const earliest = columns.map((c) => c.startTime).sort()[0] ?? '';
  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: '実施日時: ', bold: true, color: clr.textMuted }),
      new TextRun({ text: earliest, color: clr.text }),
    ],
  }));
  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: '対象部署: ', bold: true, color: clr.textMuted }),
      new TextRun({ text: columns.map((c) => c.label).join('、'), color: clr.text }),
    ],
  }));
  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: '担当者: ', bold: true, color: clr.textMuted }),
      new TextRun({ text: [...new Set(columns.map((c) => c.inspectorName).filter(Boolean))].join('、'), color: clr.text }),
    ],
  }));

  children.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: clr.primary } },
    spacing: { after: 300 },
    children: [],
  }));

  // ===== Section 1: 部署別チェックリスト =====
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 160 },
    children: [
      new TextRun({ text: '1', bold: true, size: 26, color: clr.primary }),
      new TextRun({ text: '  チェックリスト（部署別）', bold: true, size: 26, color: clr.text }),
    ],
  }));

  for (const cat of categories) {
    if (cat.items.length === 0) continue;

    children.push(new Paragraph({
      spacing: { before: 160, after: 80 },
      children: [new TextRun({ text: `【${cat.category}】`, bold: true, size: 22, color: clr.primary })],
    }));

    const rows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          headerCell('チェック項目', itemColW, clr),
          ...columns.map((col) => headerCell(col.label, DEPT_COL_W, clr, true)),
        ],
      }),
    ];

    for (const item of cat.items) {
      rows.push(new TableRow({
        children: [
          new TableCell({
            width: { size: itemColW, type: WidthType.DXA },
            shading: { type: ShadingType.SOLID, color: 'FFFFFF', fill: 'FFFFFF' },
            children: [new Paragraph({ children: [new TextRun({ text: item.description, size: 18, color: clr.text })] })],
          }),
          ...columns.map((col) => {
            const rating = col.ratings.get(item.id) ?? null;
            const text = rating ?? '—';
            const color = rating ? RATING_HEX[rating] : clr.textFaint;
            return new TableCell({
              width: { size: DEPT_COL_W, type: WidthType.DXA },
              shading: { type: ShadingType.SOLID, color: 'FFFFFF', fill: 'FFFFFF' },
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text, bold: true, size: 22, color })],
              })],
            });
          }),
        ],
      }));
    }

    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths,
      layout: TableLayoutType.FIXED,
      rows,
    }));
  }

  // ===== Section 2: 部署別の総評 =====
  children.push(new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: clr.line } },
    spacing: { before: 300 },
    children: [],
  }));
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 160 },
    children: [
      new TextRun({ text: '2', bold: true, size: 26, color: clr.primary }),
      new TextRun({ text: '  総評（部署別）', bold: true, size: 26, color: clr.text }),
    ],
  }));

  for (const col of columns) {
    children.push(deptHeading(col, clr));
    const body = col.roundData.overallEvaluation.trim();
    if (body) {
      for (const line of body.split('\n')) {
        children.push(new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: line, size: 22, color: clr.text })],
        }));
      }
    } else {
      children.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: '（記載なし）', size: 22, color: clr.textFaint })],
      }));
    }
  }

  // ===== Section 3: 部署別の写真 =====
  const photosByDept = columns.map((col) => ({
    col,
    entries: collectPhotoEntries(col.roundData, col.categories),
  })).filter((d) => d.entries.length > 0);

  if (photosByDept.length > 0) {
    children.push(new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 2, color: clr.line } },
      spacing: { before: 300 },
      children: [],
    }));
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 160 },
      children: [
        new TextRun({ text: '3', bold: true, size: 26, color: clr.primary }),
        new TextRun({ text: '  写真記録とICTコメント（部署別）', bold: true, size: 26, color: clr.text }),
      ],
    }));

    for (const { col, entries } of photosByDept) {
      children.push(deptHeading(col, clr));
      children.push(...buildPhotoTables(entries, clr));
    }
  }

  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
      children,
    }],
  });
  return Packer.toBlob(doc);
}

function deptHeading(col: DeptColumn, clr: DocxColors): Paragraph {
  // label は重複回避で担当者名を含むことがあるので、その場合は担当者名を繰り返さない
  const inspector = col.inspectorName.trim();
  const suffix = inspector && !col.label.includes(inspector) ? `（担当: ${inspector}）` : '';
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text: `■ ${col.label}${suffix}`, bold: true, size: 22, color: clr.primary })],
  });
}
