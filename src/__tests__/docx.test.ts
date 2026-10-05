import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import { buildDocxBlob } from '../docx';
import type { ChecklistCategory, RoundData } from '../types';

// getDocxColors は CSS 変数を読むため、environment: 'node' では最小限の stub を置く
vi.stubGlobal('document', { documentElement: {} });
vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: () => '' }));

const HYGIENE: ChecklistCategory = {
  category: '手指衛生',
  items: [{ id: 'shushi-1', category: '手指衛生', description: '擦式消毒薬がある' }],
};

function makeRoundData(overallEvaluation: string): RoundData {
  return {
    inspectorName: '山口',
    wardName: '3階東病棟',
    startTime: '2026-09-19 10:00',
    checklistResults: [{ itemId: 'shushi-1', rating: 'A', photos: [] }],
    generalPhotos: [],
    overallEvaluation,
  };
}

async function readDocumentXml(blob: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const part = zip.file('word/document.xml');
  if (!part) throw new Error('word/document.xml がありません');
  return part.async('string');
}

/** 本文の文字列をすべて取り出す（w:tcPr などを拾わないよう w:t だけに絞る） */
function allTexts(xml: string): string[] {
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>(.*?)<\/w:t>/g)].map(([, text]) => text);
}

/** 段落ごとの文字列（空の段落は空文字になる） */
function paragraphTexts(xml: string): string[] {
  return [...xml.matchAll(/<w:p(?:\s[^>]*)?>(.*?)<\/w:p>/g)].map(([, p]) => allTexts(p).join(''));
}

/** 総評の節見出し（'3' と '  総評' の2つの TextRun からなる段落） */
const EVALUATION_HEADING = '3  総評';

describe('buildDocxBlob（総評の出力）', () => {
  it('総評を行ごとの段落として出力する', async () => {
    const xml = await readDocumentXml(
      await buildDocxBlob(makeRoundData('手指衛生は良好\n手袋の外し方に改善余地'), [HYGIENE])
    );

    const paragraphs = paragraphTexts(xml);
    const headingIndex = paragraphs.indexOf(EVALUATION_HEADING);
    expect(paragraphs[headingIndex + 1]).toBe('手指衛生は良好');
    expect(paragraphs[headingIndex + 2]).toBe('手袋の外し方に改善余地');
  });

  it('総評が空のときは節見出しと書き込み用の空段落だけを出す', async () => {
    const xml = await readDocumentXml(await buildDocxBlob(makeRoundData(''), [HYGIENE]));

    expect(allTexts(xml)).not.toContain('（記載なし）');
    // 見出しの直後に、あとから Word で書き込める空の段落が1つある
    const paragraphs = paragraphTexts(xml);
    const headingIndex = paragraphs.indexOf(EVALUATION_HEADING);
    expect(headingIndex).toBeGreaterThan(-1);
    expect(paragraphs.slice(headingIndex + 1)).toEqual(['']);
  });

  it('総評が空白のみのときも未記載として扱う', async () => {
    const xml = await readDocumentXml(await buildDocxBlob(makeRoundData(' \n\t '), [HYGIENE]));

    expect(allTexts(xml)).not.toContain('（記載なし）');
    const paragraphs = paragraphTexts(xml);
    const headingIndex = paragraphs.indexOf(EVALUATION_HEADING);
    expect(headingIndex).toBeGreaterThan(-1);
    expect(paragraphs.slice(headingIndex + 1)).toEqual(['']);
  });
});
