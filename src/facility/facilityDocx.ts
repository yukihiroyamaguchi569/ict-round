import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, TableLayoutType, PageOrientation, VerticalAlign, LineRuleType,
} from 'docx';
import { getDocxColors, buildPhotoTables, type DocxColors, type PhotoEntry } from '../docx';
import { CONTENT_W, ITEM_COL_MIN } from '../merge/mergedTableWidths';
import type { FacilityDepartment } from './facilitySettings';
import {
  cellState, departmentComment, departmentCompliance, type CellState, type FacilityRound,
} from './facilityRound';

/** Fill of a not-applicable cell. */
export const NOT_APPLICABLE_FILL = 'D9D9D9';
/** Width of the item number column. */
const NUMBER_COL_W = 500;
/** Department column width when there are few departments. */
const DEPT_COL_W = 1100;
/** Narrower department columns make the names and marks hard to read. */
const DEPT_COL_MIN = 700;
/** Departments that fit one table at DEPT_COL_MIN; more are split into further tables. */
export const FACILITY_TABLE_DEPT_MAX = Math.floor((CONTENT_W - NUMBER_COL_W - ITEM_COL_MIN) / DEPT_COL_MIN);

/** Full-width space between a label and its text (a template literal cannot hold it as is). */
const WIDE_SPACE = '\u3000';
/**
 * Exact line height (twips) of the 10pt text lines, so lines whose characters fall back to
 * different fonts (Latin digits vs Japanese) are still evenly spaced.
 */
const TEXT_LINE = { line: 300, lineRule: LineRuleType.EXACT } as const;
/** Half-points; marks are large so ○ and × read at a glance. */
const MARK_SIZE = 36;

const CELL_TEXT: Record<Exclude<CellState, 'notApplicable'>, { text: string; color: string }> = {
  ok: { text: '○', color: '006B3C' },
  ng: { text: '×', color: 'B00020' },
  unchecked: { text: '／', color: '808080' },
};

/** Device-local "yyyy/m/d H:mm"; the ISO text itself when it is not a date. */
export function formatReportDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "職種：名前、名前" per role, roles in order of first appearance. */
export function memberLines(round: FacilityRound): string[] {
  const byRole = new Map<string, string[]>();
  for (const m of round.members) byRole.set(m.role, [...(byRole.get(m.role) ?? []), m.name]);
  return [...byRole].map(([role, names]) => `${role}：${names.join('、')}`);
}

/**
 * Departments split into tables of at most `max` columns, breaking between groups;
 * a group larger than `max` is itself split.
 */
export function splitDepartments(departments: FacilityDepartment[], max = FACILITY_TABLE_DEPT_MAX): FacilityDepartment[][] {
  const chunks: FacilityDepartment[][] = [];
  let current: FacilityDepartment[] = [];
  for (const group of groupRuns(departments)) {
    if (current.length > 0 && current.length + group.length > max) {
      chunks.push(current);
      current = [];
    }
    for (const d of group) {
      if (current.length === max) {
        chunks.push(current);
        current = [];
      }
      current.push(d);
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** Consecutive departments of the same group. */
function groupRuns(departments: FacilityDepartment[]): FacilityDepartment[][] {
  const runs: FacilityDepartment[][] = [];
  for (const d of departments) {
    const last = runs.at(-1);
    if (last && last[0].group === d.group) last.push(d);
    else runs.push([d]);
  }
  return runs;
}

function textParagraph(text: string, opts: { size?: number; bold?: boolean; color?: string; center?: boolean } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
    children: [new TextRun({ text, size: opts.size ?? 18, bold: opts.bold, color: opts.color })],
  });
}

function cell(width: number, children: Paragraph[], fill = 'FFFFFF', columnSpan?: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    columnSpan,
    verticalAlign: VerticalAlign.CENTER,
    shading: { type: ShadingType.SOLID, color: fill, fill },
    children,
  });
}

function headerCell(text: string, width: number, clr: DocxColors, columnSpan?: number): TableCell {
  return cell(width, [textParagraph(text, { bold: true, color: clr.primary, center: true })], clr.primaryLt, columnSpan);
}

function markCell(state: CellState, width: number): TableCell {
  if (state === 'notApplicable') return cell(width, [new Paragraph({ children: [] })], NOT_APPLICABLE_FILL);
  const { text, color } = CELL_TEXT[state];
  return cell(width, [textParagraph(text, { size: MARK_SIZE, bold: true, color, center: true })]);
}

function complianceText(round: FacilityRound, departmentName: string): string {
  const { rate } = departmentCompliance(round, departmentName);
  return rate === null ? '－' : `${Math.round(rate * 100)}%`;
}

/** Group name row: consecutive departments of the same group share one merged cell. */
function groupRow(departments: FacilityDepartment[], itemW: number, deptW: number, clr: DocxColors): TableRow {
  const spans = groupRuns(departments).map((run) => ({ group: run[0].group, count: run.length }));
  return new TableRow({
    tableHeader: true,
    children: [
      headerCell('', NUMBER_COL_W + itemW, clr, 2),
      ...spans.map((s) => headerCell(s.group, deptW * s.count, clr, s.count)),
    ],
  });
}

function buildMarkTable(round: FacilityRound, departments: FacilityDepartment[], clr: DocxColors): Table {
  const deptW = Math.min(DEPT_COL_W, Math.floor((CONTENT_W - NUMBER_COL_W - ITEM_COL_MIN) / departments.length));
  const itemW = CONTENT_W - NUMBER_COL_W - deptW * departments.length;
  const deptHeader = new TableRow({
    tableHeader: true,
    children: [
      headerCell('No', NUMBER_COL_W, clr),
      headerCell('項目', itemW, clr),
      ...departments.map((d) => headerCell(d.name, deptW, clr)),
    ],
  });
  const itemRows = round.items.map((item, i) => new TableRow({
    cantSplit: true,
    children: [
      cell(NUMBER_COL_W, [textParagraph(String(i + 1), { center: true, color: clr.text })]),
      cell(itemW, [textParagraph(item.text, { color: clr.text })]),
      ...departments.map((d) => markCell(cellState(round, d, item), deptW)),
    ],
  }));
  const complianceRow = new TableRow({
    cantSplit: true,
    children: [
      headerCell('遵守率', NUMBER_COL_W + itemW, clr, 2),
      ...departments.map((d) => cell(deptW, [textParagraph(complianceText(round, d.name), { bold: true, color: clr.text, center: true })])),
    ],
  });
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [NUMBER_COL_W, itemW, ...departments.map(() => deptW)],
    layout: TableLayoutType.FIXED,
    rows: [groupRow(departments, itemW, deptW, clr), deptHeader, ...itemRows, complianceRow],
  });
}

function sectionHeading(text: string, clr: DocxColors): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, color: clr.text })],
  });
}

function buildHeader(round: FacilityRound, clr: DocxColors): Paragraph[] {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [new TextRun({ text: `感染対策ラウンド${WIDE_SPACE}${round.themeName}`, bold: true, size: 32, color: clr.text })],
    }),
    ...[formatReportDateTime(round.startedAt), ...memberLines(round)].map((line) => new Paragraph({
      spacing: { before: 0, after: 60, ...TEXT_LINE },
      children: [new TextRun({ text: line, size: 20, color: clr.text })],
    })),
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({ text: '○', bold: true, size: 18, color: CELL_TEXT.ok.color }),
        new TextRun({ text: ' できている　', size: 18, color: clr.textMuted }),
        new TextRun({ text: '×', bold: true, size: 18, color: CELL_TEXT.ng.color }),
        new TextRun({ text: ' できていない　', size: 18, color: clr.textMuted }),
        new TextRun({ text: '／ 確認なし　', size: 18, color: clr.textMuted }),
        new TextRun({ text: '　　', size: 18, shading: { type: ShadingType.SOLID, color: NOT_APPLICABLE_FILL, fill: NOT_APPLICABLE_FILL } }),
        new TextRun({ text: ' 対象外', size: 18, color: clr.textMuted }),
      ],
    }),
  ];
}

/** One paragraph; the lines after the first are line breaks inside it, so they stay with the prefix. */
function multiLine(text: string, prefix: string, clr: DocxColors): Paragraph {
  return new Paragraph({
    spacing: { after: 80, ...TEXT_LINE },
    children: text.split('\n').map((line, i) =>
      new TextRun({ text: i === 0 ? `${prefix}${line}` : line, break: i === 0 ? undefined : 1, size: 20, color: clr.text })
    ),
  });
}

function buildComments(round: FacilityRound, clr: DocxColors): Paragraph[] {
  const comments = round.departments.flatMap((d) => {
    const text = departmentComment(round, d.name).trim();
    return text ? [multiLine(text, `・${d.name}${WIDE_SPACE}`, clr)] : [];
  });
  const overall = round.overallComment.trim();
  return [
    sectionHeading('部署ごとのコメント', clr),
    ...(comments.length > 0 ? comments : [textParagraph('（なし）', { size: 20, color: clr.textMuted })]),
    sectionHeading('総評', clr),
    ...(overall ? [multiLine(overall, '', clr)] : [textParagraph('（未記入）', { size: 20, color: clr.textMuted })]),
  ];
}

/** × photos in department order, then item order; photos without an image are skipped. */
export function facilityPhotoEntries(round: FacilityRound, photoDataUrls: Record<string, string>): PhotoEntry[] {
  return round.departments.flatMap((d) => round.items.flatMap((item) =>
    round.photos
      .filter((p) => p.department === d.name && p.itemId === item.id && Object.hasOwn(photoDataUrls, p.id))
      .map((p) => ({
        label: `${d.name}：${item.text}`,
        photo: { id: p.id, dataUrl: photoDataUrls[p.id], comment: p.comment, timestamp: p.takenAt, width: p.width, height: p.height },
      }))
  ));
}

/** The report of one all-department round: A4 landscape, header, mark tables, comments, overall comment, photos. */
export async function buildFacilityDocxBlob(round: FacilityRound, photoDataUrls: Record<string, string>): Promise<Blob> {
  const clr = getDocxColors();
  const tables = splitDepartments(round.departments).flatMap((departments) => [
    buildMarkTable(round, departments, clr),
    new Paragraph({ spacing: { after: 120 }, children: [] }),
  ]);
  const photos = facilityPhotoEntries(round, photoDataUrls);
  const doc = new Document({
    sections: [{
      properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } },
      children: [
        ...buildHeader(round, clr),
        ...tables,
        ...buildComments(round, clr),
        ...(photos.length > 0 ? [sectionHeading('写真', clr), ...buildPhotoTables(photos, clr, CONTENT_W)] : []),
      ],
    }],
  });
  return Packer.toBlob(doc);
}
