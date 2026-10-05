import { afterEach, describe, it, expect, vi } from 'vitest';
import { base64ToUint8Array, collectPhotoEntries, fitContain, getCssHex, getDocxColors } from '../docx';
import type { ChecklistCategory, Photo, RoundData } from '../types';

/** Stub the computed style of the root element with CSS variable values */
function stubCssVars(vars: Record<string, string>) {
  const root = {};
  vi.stubGlobal('document', { documentElement: root });
  const getComputedStyle = vi.fn((el: unknown) => ({
    getPropertyValue: (name: string) => (el === root ? vars[name] ?? '' : ''),
  }));
  vi.stubGlobal('getComputedStyle', getComputedStyle);
  return getComputedStyle;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getCssHex', () => {
  it('ルート要素の CSS 変数から前後の空白と # を落とした6桁の16進を返す', () => {
    const getComputedStyle = stubCssVars({ '--c': '  #1a2B3c ' });

    expect(getCssHex('--c')).toBe('1a2B3c');
    expect(getComputedStyle).toHaveBeenCalledWith(document.documentElement);
  });

  it('# の無い6桁の16進もそのまま返す', () => {
    stubCssVars({ '--c': '00ff00' });

    expect(getCssHex('--c')).toBe('00ff00');
  });

  it.each([
    ['未定義', ''],
    ['色名', 'red'],
    ['3桁', '#abc'],
    ['5桁', '#12345'],
    ['7桁', '#1234567'],
    ['16進以外の文字で始まる', 'x12345'],
    ['16進以外の文字を含む', '#12g456'],
  ])('6桁の16進でない値（%s）は既定の CCCCCC にする', (_label, value) => {
    stubCssVars({ '--c': value });

    expect(getCssHex('--c')).toBe('CCCCCC');
  });
});

describe('getDocxColors', () => {
  it('テーマの CSS 変数を役割ごとの色に読み替える', () => {
    stubCssVars({
      '--t-primary': '#000001',
      '--t-primary-light': '#000002',
      '--t-base': '#000003',
      '--t-text': '#000004',
      '--t-text-muted': '#000005',
      '--t-text-faint': '#000006',
      '--t-line': '#000007',
    });

    expect(getDocxColors()).toEqual({
      primary: '000001',
      primaryLt: '000002',
      base: '000003',
      text: '000004',
      textMuted: '000005',
      textFaint: '000006',
      line: '000007',
    });
  });
});

describe('fitContain', () => {
  it.each([
    ['横長', 300, 150, { width: 150, height: 75 }],
    ['縦長', 150, 300, { width: 75, height: 150 }],
    ['枠より小さい画像は枠まで拡大する', 10, 10, { width: 150, height: 150 }],
    ['端数は四捨五入する', 7, 3, { width: 150, height: 64 }],
  ])('縦横比を保って 150 の枠に収める（%s）', (_label, w, h, expected) => {
    expect(fitContain(w, h)).toEqual(expected);
  });

  it('枠の大きさを指定できる', () => {
    expect(fitContain(10, 20, 40)).toEqual({ width: 20, height: 40 });
  });

  it.each([
    ['幅も高さも無い', undefined, undefined],
    ['幅が無い', undefined, 100],
    ['高さが無い', 100, undefined],
    ['幅が 0', 0, 100],
    ['高さが 0', 100, 0],
  ])('大きさが分からない写真（%s）は 4:3 の既定の大きさにする', (_label, w, h) => {
    expect(fitContain(w, h)).toEqual({ width: 148, height: 111 });
  });
});

describe('base64ToUint8Array', () => {
  it('data URL の base64 部分をバイト列にする', () => {
    expect([...base64ToUint8Array('data:image/jpeg;base64,AAEC/w==')]).toEqual([0, 1, 2, 255]);
  });

  it('中身が空なら空のバイト列にする', () => {
    expect(base64ToUint8Array('data:image/jpeg;base64,')).toHaveLength(0);
  });

  it('base64 でない中身は例外にする（呼び出し側で画像を飛ばす）', () => {
    expect(() => base64ToUint8Array('data:image/jpeg;base64,***')).toThrow();
  });
});

describe('collectPhotoEntries', () => {
  const categories: ChecklistCategory[] = [{
    category: '手指衛生',
    items: [
      { id: 'short', category: '手指衛生', description: '短い項目' },
      { id: 'long', category: '手指衛生', description: '一二三四五六七八九十一二三四五六七八九十超過分' },
    ],
  }];

  function photo(id: string): Photo {
    return { id, dataUrl: 'data:,', comment: '', timestamp: '2026-09-19T01:00:00.000Z' };
  }

  function makeRound(overrides: Partial<RoundData>): RoundData {
    return {
      inspectorName: '山口', wardName: '', startTime: '', checklistResults: [], generalPhotos: [], overallEvaluation: '',
      ...overrides,
    };
  }

  it('項目の写真を結果の順に、項目名を付けて並べ、その後に全体写真をラベルなしで並べる', () => {
    const round = makeRound({
      checklistResults: [
        { itemId: 'short', rating: 'A', photos: [photo('s1'), photo('s2')] },
        { itemId: 'long', rating: null, photos: [] },
      ],
      generalPhotos: [photo('g1')],
    });

    expect(collectPhotoEntries(round, categories).map(({ photo: p, label }) => [p.id, label])).toEqual([
      ['s1', '手指衛生: 短い項目'],
      ['s2', '手指衛生: 短い項目'],
      ['g1', ''],
    ]);
  });

  it('項目の文言は先頭20文字までにする', () => {
    const round = makeRound({ checklistResults: [{ itemId: 'long', rating: 'B', photos: [photo('l1')] }] });

    expect(collectPhotoEntries(round, categories)[0].label).toBe('手指衛生: 一二三四五六七八九十一二三四五六七八九十');
  });

  it('チェックリストに無い項目の写真もラベルを空にして残す', () => {
    const round = makeRound({ checklistResults: [{ itemId: 'gone', rating: 'C', photos: [photo('x1')] }] });

    expect(collectPhotoEntries(round, categories)).toEqual([{ photo: photo('x1'), label: ': ' }]);
  });

  it('写真が無ければ空にする', () => {
    expect(collectPhotoEntries(makeRound({}), categories)).toEqual([]);
  });
});
