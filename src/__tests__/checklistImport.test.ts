import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseCsv, parseXlsx } from '../checklistImport';

describe('parseCsv', () => {
  it('カテゴリごとに項目をグルーピングする', () => {
    const result = parseCsv('手指衛生,項目1\n手指衛生,項目2\n水回り,項目3');
    expect(result).toHaveLength(2);
    expect(result[0].category).toBe('手指衛生');
    expect(result[0].items).toHaveLength(2);
    expect(result[1].items).toHaveLength(1);
  });

  it('同一カテゴリ内で ID に連番を振る', () => {
    const result = parseCsv('手指衛生,項目1\n手指衛生,項目2');
    const ids = result[0].items.map((i) => i.id);
    expect(ids[0]).toMatch(/-1$/);
    expect(ids[1]).toMatch(/-2$/);
    expect(new Set(ids).size).toBe(2);
  });

  it('日本語カテゴリ名でも ID が空にならない', () => {
    const result = parseCsv('手指衛生,項目1');
    expect(result[0].items[0].id).toBe('手指衛生-1');
  });

  it('見出し行（1行目が category）をスキップする', () => {
    const result = parseCsv('category,description\n手指衛生,項目1');
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(1);
  });

  it('引用符で囲まれたカンマを項目の一部として扱う', () => {
    const result = parseCsv('手指衛生,"手洗い、手指消毒の両方"');
    expect(result[0].items[0].description).toBe('手洗い、手指消毒の両方');
  });

  it('引用符のエスケープ（""）を1つの引用符に戻す', () => {
    const result = parseCsv('手指衛生,"いわゆる""5つのタイミング"""');
    expect(result[0].items[0].description).toBe('いわゆる"5つのタイミング"');
  });

  it('空行と2列未満の行を無視する', () => {
    const result = parseCsv('手指衛生,項目1\n\n列が1つだけ\n手指衛生,項目2');
    expect(result[0].items).toHaveLength(2);
  });

  it('片方の列が空の行を無視する', () => {
    const result = parseCsv('手指衛生,項目1\n手指衛生,\n,項目X');
    expect(result[0].items).toHaveLength(1);
  });

  it('有効な行が1つも無ければエラーを投げる', () => {
    expect(() => parseCsv('')).toThrow();
    expect(() => parseCsv('列が1つだけ')).toThrow();
  });
});

describe('parseXlsx', () => {
  // 実ファイルを読んで取り込み経路を通しで検証する
  async function loadFixture(relativePath: string) {
    const path = fileURLToPath(new URL(relativePath, import.meta.url));
    const buf = readFileSync(path);
    const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    return parseXlsx(arrayBuffer as ArrayBuffer);
  }

  const countItems = (cats: Awaited<ReturnType<typeof loadFixture>>) =>
    cats.reduce((sum, cat) => sum + cat.items.length, 0);

  it('配布テンプレートを読み込んでカテゴリに変換できる', async () => {
    const result = await loadFixture('../../public/round-checklist-template.xlsx');

    expect(result.length).toBeGreaterThan(0);
    expect(countItems(result)).toBeGreaterThan(0);
    // 日本語が文字化けせず読めていること
    expect(result[0].category).toBe('手指衛生');
    expect(result[0].items[0].description).toContain('手指衛生');
  });

  it('複数カテゴリをグルーピングして読み込む', async () => {
    const result = await loadFixture('./fixtures/checklist-normal.xlsx');

    expect(result.map((c) => c.category)).toEqual(['手指衛生', '個人防護具', '環境整備']);
    expect(result.map((c) => c.items.length)).toEqual([3, 2, 2]);
    expect(countItems(result)).toBe(7);
  });

  it('見出し行（1行目が category）をスキップする', async () => {
    const result = await loadFixture('./fixtures/checklist-with-header.xlsx');

    expect(result.map((c) => c.category)).toEqual(['手指衛生', '廃棄物']);
    expect(countItems(result)).toBe(4);
    // 見出し行がカテゴリとして混入していないこと
    expect(result.some((c) => c.category === 'category')).toBe(false);
  });

  it('空行・片側だけのセルを無視して有効な行のみ取り込む', async () => {
    const result = await loadFixture('./fixtures/checklist-messy.xlsx');

    expect(result.map((c) => c.category)).toEqual(['手指衛生', '水回り', '汚物室・トイレ']);
    expect(countItems(result)).toBe(4);
    // 片側のセルしかない行がカテゴリ・項目として混入していないこと
    expect(result.some((c) => c.category === 'カテゴリだけの行')).toBe(false);
    expect(
      result.flatMap((c) => c.items).some((i) => i.description === '項目だけの行')
    ).toBe(false);
  });
});
