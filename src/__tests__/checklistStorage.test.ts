import { describe, it, expect } from 'vitest';
import type { SavedChecklist, SavedRound } from '../types';
import {
  loadLibrary,
  saveLibrary,
  addChecklist,
  deleteChecklist,
  getActiveId,
  setActiveId,
  loadSavedRounds,
  upsertSavedRound,
  deleteSavedRound,
  seedDefaultIfFirstRun,
} from '../checklistStorage';

const LIBRARY_KEY = 'icn-round:checklist-library';
const ROUNDS_KEY = 'icn-round:saved-rounds';

function makeChecklist(id: string, name = id): SavedChecklist {
  return {
    id,
    name,
    createdAt: '2026-07-30T00:00:00.000Z',
    categories: [
      { category: '手指衛生', items: [{ id: `${id}-1`, category: '手指衛生', description: '項目' }] },
    ],
  };
}

function makeRound(id: string, inspectorName = '山田'): SavedRound {
  return {
    id,
    title: `${inspectorName}（2026/07/30）`,
    savedAt: '2026-07-30T00:00:00.000Z',
    version: 1,
    checklistId: 'default',
    roundData: {
      inspectorName,
      wardName: '3階東',
      startTime: '2026/07/30 10:00',
      checklistResults: [],
      generalPhotos: [],
      overallEvaluation: '',
    },
  };
}

describe('チェックリストライブラリ', () => {
  it('未保存なら空配列を返す', () => {
    expect(loadLibrary()).toEqual([]);
  });

  it('保存した内容をそのまま読み戻せる', () => {
    const list = [makeChecklist('a'), makeChecklist('b')];
    saveLibrary(list);
    expect(loadLibrary()).toEqual(list);
  });

  it('addChecklist は既存を保ったまま末尾に追加する', () => {
    saveLibrary([makeChecklist('a')]);
    addChecklist(makeChecklist('b'));
    expect(loadLibrary().map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('deleteChecklist は指定IDのみ削除する', () => {
    saveLibrary([makeChecklist('a'), makeChecklist('b'), makeChecklist('c')]);
    deleteChecklist('b');
    expect(loadLibrary().map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('deleteChecklist は存在しないIDでも既存を壊さない', () => {
    saveLibrary([makeChecklist('a')]);
    deleteChecklist('not-exist');
    expect(loadLibrary().map((c) => c.id)).toEqual(['a']);
  });

  it('壊れた JSON が保存されていても空配列を返す', () => {
    localStorage.setItem(LIBRARY_KEY, '{壊れたデータ');
    expect(loadLibrary()).toEqual([]);
  });
});

describe('アクティブなチェックリストID', () => {
  it('未設定なら null を返す', () => {
    expect(getActiveId()).toBeNull();
  });

  it('設定した値を読み戻せる', () => {
    setActiveId('abc');
    expect(getActiveId()).toBe('abc');
  });
});

describe('保存済みラウンド', () => {
  it('未保存なら空配列を返す', () => {
    expect(loadSavedRounds()).toEqual([]);
  });

  it('upsertSavedRound は新規IDを追加する', () => {
    upsertSavedRound(makeRound('r1'));
    upsertSavedRound(makeRound('r2'));
    expect(loadSavedRounds().map((r) => r.id)).toEqual(['r1', 'r2']);
  });

  it('upsertSavedRound は同一IDを上書きし、件数を増やさない', () => {
    upsertSavedRound(makeRound('r1', '山田'));
    upsertSavedRound(makeRound('r1', '佐藤'));

    const rounds = loadSavedRounds();
    expect(rounds).toHaveLength(1);
    expect(rounds[0].roundData.inspectorName).toBe('佐藤');
  });

  it('upsertSavedRound は上書き時に並び順を変えない', () => {
    upsertSavedRound(makeRound('r1'));
    upsertSavedRound(makeRound('r2'));
    upsertSavedRound(makeRound('r3'));
    upsertSavedRound(makeRound('r1', '更新'));

    expect(loadSavedRounds().map((r) => r.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('deleteSavedRound は指定IDのみ削除する', () => {
    upsertSavedRound(makeRound('r1'));
    upsertSavedRound(makeRound('r2'));
    deleteSavedRound('r1');
    expect(loadSavedRounds().map((r) => r.id)).toEqual(['r2']);
  });

  it('壊れた JSON が保存されていても空配列を返す', () => {
    localStorage.setItem(ROUNDS_KEY, 'not json');
    expect(loadSavedRounds()).toEqual([]);
  });
});

describe('seedDefaultIfFirstRun', () => {
  it('初回は標準チェックリストを投入し、アクティブIDも設定する', () => {
    const result = seedDefaultIfFirstRun();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('default');
    expect(result[0].isDefault).toBe(true);
    expect(result[0].categories.length).toBeGreaterThan(0);
    expect(getActiveId()).toBe('default');
    expect(loadLibrary().map((c) => c.id)).toEqual(['default']);
  });

  it('2回目以降は何も投入せず既存を返す', () => {
    seedDefaultIfFirstRun();
    setActiveId('user-selected');

    const second = seedDefaultIfFirstRun();

    expect(second.map((c) => c.id)).toEqual(['default']);
    expect(loadLibrary()).toHaveLength(1);
    // 既存があるときはアクティブIDを上書きしない
    expect(getActiveId()).toBe('user-selected');
  });

  it('取込済みチェックリストがある場合は標準を追加しない', () => {
    saveLibrary([makeChecklist('imported')]);

    const result = seedDefaultIfFirstRun();

    expect(result.map((c) => c.id)).toEqual(['imported']);
    expect(loadLibrary().map((c) => c.id)).toEqual(['imported']);
  });
});
