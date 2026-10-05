import { describe, it, expect } from 'vitest';
import { parseRoundExport } from '../merge/mergeRounds';
import { makeRoundExport } from './fixtures/roundDocx';

/** 妥当な RoundExport を JSON にしてから、一部を書き換えた文字列 */
function brokenJson(patch: (value: Record<string, unknown> & { roundData: Record<string, unknown> }) => void): string {
  const value = JSON.parse(JSON.stringify(makeRoundExport({ wardName: '3階東病棟', ratings: { h1: 'A' } })));
  patch(value);
  return JSON.stringify(value);
}

describe('parseRoundExport（壊れた箇所の示し方）', () => {
  it.each([
    ['作成日時', (v: Record<string, unknown>) => delete v.exportedAt],
    ['チェックリスト名', (v: Record<string, unknown>) => delete v.checklistName],
  ])('トップレベルの %s が文字列でなければその名前で示す', (where, patch) => {
    expect(() => parseRoundExport(brokenJson(patch))).toThrow(`ラウンドデータの形式が壊れています（${where}）`);
  });

  it.each([
    ['担当者名', 'inspectorName'],
    ['実施日時', 'startTime'],
  ])('roundData の %s が文字列でなければその名前で示す', (where, field) => {
    expect(() => parseRoundExport(brokenJson((v) => { v.roundData[field] = 1; }))).toThrow(
      `ラウンドデータの形式が壊れています（${where}）`
    );
  });

  it('カテゴリが null なら何番目のカテゴリかを示す', () => {
    expect(() => parseRoundExport(brokenJson((v) => { v.categories = [null]; }))).toThrow(
      'ラウンドデータの形式が壊れています（カテゴリ1）'
    );
  });

  it('カテゴリ名が文字列でなければ何番目のカテゴリの名前かを示す', () => {
    expect(() => parseRoundExport(brokenJson((v) => { v.categories = [{ category: 1, items: [] }]; }))).toThrow(
      'ラウンドデータの形式が壊れています（カテゴリ1の名前）'
    );
  });

  it('項目が null なら何番目のカテゴリの何番目の項目かを示す', () => {
    expect(() =>
      parseRoundExport(brokenJson((v) => { v.categories = [{ category: '手指衛生', items: [null] }]; }))
    ).toThrow('ラウンドデータの形式が壊れています（カテゴリ1の項目1）');
  });

  it('項目の文言が文字列でなければその項目の文言として示す', () => {
    expect(() =>
      parseRoundExport(brokenJson((v) => { v.categories = [{ category: '手指衛生', items: [{ id: 'a' }] }]; }))
    ).toThrow('ラウンドデータの形式が壊れています（カテゴリ1の項目1の文言）');
  });

  it('チェック結果が null なら何番目のチェック結果かを示す', () => {
    expect(() => parseRoundExport(brokenJson((v) => { v.roundData.checklistResults = [null]; }))).toThrow(
      'ラウンドデータの形式が壊れています（チェック結果1）'
    );
  });

  it('チェック結果の項目IDが文字列でなければそのチェック結果の項目IDとして示す', () => {
    expect(() =>
      parseRoundExport(brokenJson((v) => { v.roundData.checklistResults = [{ itemId: 1, rating: 'A', photos: [] }]; }))
    ).toThrow('ラウンドデータの形式が壊れています（チェック結果1の項目ID）');
  });
});
