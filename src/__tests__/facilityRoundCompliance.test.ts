import { describe, it, expect } from 'vitest';
import { cellState, complianceRateText, departmentCompliance, type FacilityRound } from '../facility/facilityRound';
import type { FacilityDepartment, ThemeItem } from '../facility/facilitySettings';

const EAST: FacilityDepartment = { name: '3階東', group: '病棟' };
const WEST: FacilityDepartment = { name: '3階西', group: '病棟' };
const OUTPATIENT: FacilityDepartment = { name: '内科外来', group: '外来' };

const H1: ThemeItem = { id: 'h1', text: '消毒剤がある', targetGroups: [], excludedDepartments: [] };
const H2: ThemeItem = { id: 'h2', text: '手順の掲示', targetGroups: ['外来'], excludedDepartments: [] };
const H3: ThemeItem = { id: 'h3', text: '床が清潔', targetGroups: ['病棟'], excludedDepartments: ['3階西'] };

function round(marks: FacilityRound['marks'], items: ThemeItem[] = [H1, H2, H3]): FacilityRound {
  return {
    version: 1,
    id: 'r1',
    startedAt: '2026-11-18T01:02:03.000Z',
    themeName: '手指衛生',
    items,
    departments: [OUTPATIENT, EAST, WEST],
    members: [],
    marks,
    departmentComments: {},
    overallComment: '',
    photos: [],
  };
}

describe('cellState', () => {
  const r = round({ '3階東': { h1: 'ok', h3: 'ng' }, '3階西': { h3: 'ok' } });

  it('○ / × / 未入力を返す', () => {
    expect(cellState(r, EAST, H1)).toBe('ok');
    expect(cellState(r, EAST, H3)).toBe('ng');
    expect(cellState(r, OUTPATIENT, H1)).toBe('unchecked');
  });

  it('対象外は notApplicable（対象グループ外・除外部署）', () => {
    expect(cellState(r, EAST, H2)).toBe('notApplicable');
    expect(cellState(r, OUTPATIENT, H3)).toBe('notApplicable');
  });

  it('対象外のマスに印が残っていても notApplicable', () => {
    expect(cellState(r, WEST, H3)).toBe('notApplicable');
  });

  it('"__proto__" のような名前・ID でも Object.prototype を読まない', () => {
    const item: ThemeItem = { ...H1, id: 'toString' };
    expect(cellState(r, { name: '__proto__', group: '病棟' }, item)).toBe('unchecked');
    expect(cellState(r, EAST, item)).toBe('unchecked');
  });
});

describe('departmentCompliance', () => {
  it('○ と × を数え、遵守率は ○ ÷（○＋×）', () => {
    expect(departmentCompliance(round({ '3階東': { h1: 'ok', h3: 'ng' } }), '3階東')).toEqual({ ok: 1, ng: 1, rate: 0.5 });
  });

  it('○ だけなら 1、× だけなら 0', () => {
    expect(departmentCompliance(round({ '3階東': { h1: 'ok', h3: 'ok' } }), '3階東')).toEqual({ ok: 2, ng: 0, rate: 1 });
    expect(departmentCompliance(round({ '3階東': { h1: 'ng', h3: 'ng' } }), '3階東')).toEqual({ ok: 0, ng: 2, rate: 0 });
  });

  it('一部が未入力なら未入力は数えない', () => {
    expect(departmentCompliance(round({ '3階東': { h3: 'ok' } }), '3階東')).toEqual({ ok: 1, ng: 0, rate: 1 });
  });

  it('未入力だけなら rate は null', () => {
    expect(departmentCompliance(round({}), '3階東')).toEqual({ ok: 0, ng: 0, rate: null });
    expect(departmentCompliance(round({ '3階東': {} }), '3階東')).toEqual({ ok: 0, ng: 0, rate: null });
  });

  it('対象外のマスに残った印は数えない', () => {
    const r = round({ '3階西': { h1: 'ng', h2: 'ok', h3: 'ok' } });
    expect(departmentCompliance(r, '3階西')).toEqual({ ok: 0, ng: 1, rate: 0 });
  });

  it('全部対象外の部署は 0 / 0 / null（印が残っていても）', () => {
    expect(departmentCompliance(round({ '3階東': { h2: 'ok' } }, [H2]), '3階東')).toEqual({ ok: 0, ng: 0, rate: null });
  });

  it('ラウンドに無い部署は 0 / 0 / null', () => {
    expect(departmentCompliance(round({ 外科: { h1: 'ok' } }), '外科')).toEqual({ ok: 0, ng: 0, rate: null });
  });

  it('割り切れない率もそのまま返す', () => {
    const h4: ThemeItem = { ...H1, id: 'h4' };
    const r = round({ '3階東': { h1: 'ok', h3: 'ok', h4: 'ng' } }, [H1, H2, H3, h4]);
    expect(departmentCompliance(r, '3階東').rate).toBeCloseTo(2 / 3);
  });
});

describe('complianceRateText', () => {
  it('rounds the rate to a whole percent', () => {
    expect(complianceRateText({ ok: 2, ng: 1, rate: 2 / 3 })).toBe('67%');
    expect(complianceRateText({ ok: 1, ng: 2, rate: 1 / 3 })).toBe('33%');
  });

  it('shows 0% and 100% at the ends', () => {
    expect(complianceRateText({ ok: 0, ng: 1, rate: 0 })).toBe('0%');
    expect(complianceRateText({ ok: 1, ng: 0, rate: 1 })).toBe('100%');
  });

  it('shows "－" when nothing is marked', () => {
    expect(complianceRateText({ ok: 0, ng: 0, rate: null })).toBe('－');
  });
});
