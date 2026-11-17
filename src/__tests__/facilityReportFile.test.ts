import { describe, it, expect, vi } from 'vitest';
import { embedCustomXml } from '../customXmlPart';
import { embedRoundExport, extractRoundExport } from '../roundExportDocx';
import { buildFacilityDocxBlob } from '../facility/facilityDocx';
import type { FacilityRound } from '../facility/facilityRound';
import { buildFacilityRoundExport } from '../facility/facilityRoundExport';
import {
  embedFacilityRoundExport, extractFacilityRoundExport, loadFacilityRoundFile,
} from '../facility/facilityReportFile';
import { makeEmptyDocx, makeRoundExport } from './fixtures/roundDocx';

vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));

const IMG = 'data:image/jpeg;base64,AAAA';
const PART = { namespace: 'urn:meguru-facility-round:export', rootElement: 'meguruFacilityRound' };

function round(): FacilityRound {
  return {
    version: 1,
    id: 'r1',
    startedAt: '2026-11-18T01:00:00.000Z',
    themeName: '手指衛生',
    items: [{ id: 'i1', text: '消毒剤がある', targetGroups: [], excludedDepartments: [] }],
    departments: [{ name: 'A病棟', group: '病棟' }],
    members: [{ name: '山田', role: '看護師' }],
    marks: { A病棟: { i1: 'ng' } },
    departmentComments: { A病棟: ']]> を含むコメント' },
    overallComment: '総評',
    photos: [{ id: 'p1', department: 'A病棟', itemId: 'i1', comment: '', takenAt: '2026-11-18T01:05:00.000Z' }],
  };
}

const exportData = () => buildFacilityRoundExport(round(), { p1: IMG }, new Date('2026-11-18T09:00:00.000Z'));

async function facilityReport(): Promise<Blob> {
  return embedFacilityRoundExport(await buildFacilityDocxBlob(round(), {}), exportData());
}

describe('embedFacilityRoundExport / extractFacilityRoundExport', () => {
  it('帳票に埋め込んだ記録を、写真の本体ごとそのまま取り出せる', async () => {
    const back = await extractFacilityRoundExport(await facilityReport());
    expect(back).toEqual(exportData());
    expect(back?.photos).toEqual([{ id: 'p1', dataUrl: IMG }]);
  });

  it('めぐる君の報告書のデータと同じファイルにあっても混ざらない', async () => {
    const both = await embedRoundExport(await facilityReport(), makeRoundExport({ wardName: '3東' }));
    expect(await extractFacilityRoundExport(both)).toEqual(exportData());
    expect((await extractRoundExport(both)).roundData.wardName).toBe('3東');
  });

  it('めぐる君の報告書だけなら null', async () => {
    const main = await embedRoundExport(await makeEmptyDocx(), makeRoundExport({ wardName: '3東' }));
    expect(await extractFacilityRoundExport(main)).toBeNull();
  });

  it('JSON が壊れていれば null', async () => {
    const broken = await embedCustomXml(await makeEmptyDocx(), PART, '{"format":');
    expect(await extractFacilityRoundExport(broken)).toBeNull();
  });

  it('形の違うデータなら null', async () => {
    const wrong = await embedCustomXml(await makeEmptyDocx(), PART, JSON.stringify({ ...exportData(), version: 2 }));
    expect(await extractFacilityRoundExport(wrong)).toBeNull();
  });
});

describe('loadFacilityRoundFile', () => {
  it('帳票を読むと記録を返す', async () => {
    expect(await loadFacilityRoundFile(await facilityReport())).toEqual({ ok: true, export: exportData() });
  });

  it('50MB を超えるファイルは中を読まずに too-large', async () => {
    const big = new Blob([new Uint8Array(50 * 1024 * 1024 + 1)]);
    const slice = vi.spyOn(big, 'slice');
    expect(await loadFacilityRoundFile(big)).toEqual({ ok: false, reason: 'too-large' });
    expect(slice).not.toHaveBeenCalled();
  });

  it('ちょうど 50MB は大きさでは弾かない', async () => {
    const edge = new Blob([new Uint8Array(50 * 1024 * 1024)]);
    expect(await loadFacilityRoundFile(edge)).toEqual({ ok: false, reason: 'not-docx' });
  });

  it('ZIP でなければ not-docx', async () => {
    expect(await loadFacilityRoundFile(new Blob(['hello world']))).toEqual({ ok: false, reason: 'not-docx' });
  });

  it('ZIP の署名だけで中身が壊れていれば not-docx（例外を投げない）', async () => {
    const broken = new Blob([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0])]);
    expect(await loadFacilityRoundFile(broken)).toEqual({ ok: false, reason: 'not-docx' });
  });

  it('めぐる君の報告書は no-round-data', async () => {
    const main = await embedRoundExport(await makeEmptyDocx(), makeRoundExport({ wardName: '3東' }));
    expect(await loadFacilityRoundFile(main)).toEqual({ ok: false, reason: 'no-round-data' });
  });

  it('記録の入っていない帳票は no-round-data', async () => {
    expect(await loadFacilityRoundFile(await buildFacilityDocxBlob(round(), {}))).toEqual({
      ok: false,
      reason: 'no-round-data',
    });
  });
});
