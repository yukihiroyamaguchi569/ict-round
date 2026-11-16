import { describe, it, expect } from 'vitest';
import {
  buildFacilitySettings,
  SETTINGS_SHEETS,
  VISIT_LABELS,
  type BuildSettingsResult,
  type SettingsError,
} from '../facility/facilitySettings';

/** Fake ID generator returning id-1, id-2, ... */
function sequentialIds(): () => string {
  let n = 0;
  return () => `id-${++n}`;
}

function validSheets(): Record<string, string[][]> {
  return {
    グループ: [
      ['グループ名', '回り方'],
      ['病棟', '毎回'],
      ['外来', '選ぶ'],
    ],
    部署: [
      ['部署名', 'グループ'],
      ['3階東', '病棟'],
      ['3階西', '病棟'],
      ['内科外来', '外来'],
    ],
    項目: [
      ['テーマ', '項目', '対象グループ', '対象外の部署'],
      ['手指衛生', '手指消毒剤が置いてある', '', ''],
      ['環境', '床が清潔', '病棟', '3階西'],
      ['手指衛生', '手洗い手順が掲示されている', '外来', ''],
    ],
    参加者: [
      ['氏名', '職種'],
      ['山田', '看護師'],
      ['佐藤', '医師'],
    ],
  };
}

function without(sheets: Record<string, string[][]>, ...names: string[]): Record<string, string[][]> {
  return Object.fromEntries(Object.entries(sheets).filter(([name]) => !names.includes(name)));
}

function build(sheets: Record<string, string[][]>): BuildSettingsResult {
  return buildFacilitySettings(sheets, sequentialIds());
}

function errorsOf(sheets: Record<string, string[][]>): SettingsError[] {
  const result = build(sheets);
  if (result.ok) throw new Error('expected errors');
  return result.errors;
}

describe('constants', () => {
  it('シート名と見出しを Excel の順で持つ', () => {
    expect(SETTINGS_SHEETS.map((s) => [s.name, s.headers])).toEqual([
      ['グループ', ['グループ名', '回り方']],
      ['部署', ['部署名', 'グループ']],
      ['項目', ['テーマ', '項目', '対象グループ', '対象外の部署']],
      ['参加者', ['氏名', '職種']],
    ]);
    expect(VISIT_LABELS).toEqual({ always: '毎回', select: '選ぶ' });
  });
});

describe('buildFacilitySettings: 正常系', () => {
  it('4 シートから設定を組み立てる', () => {
    expect(build(validSheets())).toEqual({
      ok: true,
      settings: {
        version: 1,
        groups: [
          { name: '病棟', visit: 'always' },
          { name: '外来', visit: 'select' },
        ],
        departments: [
          { name: '3階東', group: '病棟' },
          { name: '3階西', group: '病棟' },
          { name: '内科外来', group: '外来' },
        ],
        themes: [
          {
            name: '手指衛生',
            items: [
              { id: 'id-1', text: '手指消毒剤が置いてある', targetGroups: [], excludedDepartments: [] },
              { id: 'id-3', text: '手洗い手順が掲示されている', targetGroups: ['外来'], excludedDepartments: [] },
            ],
          },
          {
            name: '環境',
            items: [{ id: 'id-2', text: '床が清潔', targetGroups: ['病棟'], excludedDepartments: ['3階西'] }],
          },
        ],
        members: [
          { name: '山田', role: '看護師' },
          { name: '佐藤', role: '医師' },
        ],
      },
    });
  });

  it('セルと見出しの前後の空白を取る', () => {
    const sheets = validSheets();
    sheets['グループ'] = [
      [' グループ名 ', '回り方\n'],
      ['  病棟 ', ' 毎回 '],
      ['外来', '選ぶ'],
    ];
    sheets['参加者'][1] = [' 山田 ', '\t看護師 '];
    const result = build(sheets);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.settings.groups[0]).toEqual({ name: '病棟', visit: 'always' });
    expect(result.settings.members[0]).toEqual({ name: '山田', role: '看護師' });
  });

  it('見出しより右の列は無視する（見出しも値も）', () => {
    const sheets = validSheets();
    sheets['参加者'] = [
      ['氏名', '職種', 'メモ'],
      ['山田', '看護師', '備考'],
    ];
    const result = build(sheets);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.settings.members).toEqual([{ name: '山田', role: '看護師' }]);
  });

  it('対象グループ・対象外の部署の区切りの揺れを受け付け、空要素と重複を捨てる', () => {
    const sheets = validSheets();
    sheets['項目'] = [
      ['テーマ', '項目', '対象グループ', '対象外の部署'],
      ['環境', '床', '病棟、外来,病棟，', '3階東､ 3階西\n内科外来\r\n3階東,,'],
    ];
    const result = build(sheets);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.settings.themes[0].items[0]).toMatchObject({
      targetGroups: ['病棟', '外来'],
      excludedDepartments: ['3階東', '3階西', '内科外来'],
    });
  });

  it('区切りだけのセルは指定なし（全部署）として扱う', () => {
    const sheets = validSheets();
    sheets['項目'] = [
      ['テーマ', '項目', '対象グループ', '対象外の部署'],
      ['環境', '床', ' 、, ', '\n'],
    ];
    const result = build(sheets);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.settings.themes[0].items[0]).toMatchObject({ targetGroups: [], excludedDepartments: [] });
  });

  it('全セルが空の行と、列の欠けた短い行を扱える', () => {
    const sheets = validSheets();
    sheets['項目'] = [
      ['テーマ', '項目', '対象グループ', '対象外の部署'],
      ['', ' ', '', ''],
      [],
      ['環境', '床'],
    ];
    const result = build(sheets);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.settings.themes).toEqual([
      { name: '環境', items: [{ id: 'id-1', text: '床', targetGroups: [], excludedDepartments: [] }] },
    ]);
  });

  it('同じ項目名でもテーマが違えば別の項目として扱う', () => {
    const sheets = validSheets();
    sheets['項目'] = [
      ['テーマ', '項目', '対象グループ', '対象外の部署'],
      ['手指衛生', '掲示', '', ''],
      ['環境', '掲示', '', ''],
    ];
    const result = build(sheets);
    expect(result.ok).toBe(true);
  });

  it('余分なシートは無視する', () => {
    expect(build({ ...validSheets(), 使い方: [['説明']] }).ok).toBe(true);
  });
});

describe('buildFacilitySettings: シート単位の誤り', () => {
  it('シートが無い', () => {
    expect(errorsOf(without(validSheets(), '参加者'))).toEqual([{ sheet: '参加者', message: '「参加者」シートがありません' }]);
  });

  it('シート名は前後の空白も含めて一致させる', () => {
    const sheets = validSheets();
    expect(errorsOf({ ...without(sheets, '参加者'), ' 参加者': sheets['参加者'] })).toEqual([
      { sheet: '参加者', message: '「参加者」シートがありません' },
    ]);
  });

  it('見出しが違う（順番違い・欠け・空のシート）', () => {
    const sheets = validSheets();
    sheets['グループ'][0] = ['回り方', 'グループ名'];
    sheets['部署'][0] = ['部署名'];
    sheets['参加者'] = [];
    expect(errorsOf(sheets)).toEqual([
      { sheet: 'グループ', row: 1, message: '1 行目の見出しを左から「グループ名」「回り方」の順にしてください' },
      { sheet: '部署', row: 1, message: '1 行目の見出しを左から「部署名」「グループ」の順にしてください' },
      { sheet: '参加者', row: 1, message: '1 行目の見出しを左から「氏名」「職種」の順にしてください' },
    ]);
  });

  it('見出しだけでデータが 0 行', () => {
    const sheets = validSheets();
    sheets['参加者'] = [['氏名', '職種']];
    expect(errorsOf(sheets)).toEqual([
      { sheet: '参加者', message: '「参加者」シートにデータの行がありません（2 行目から書いてください）' },
    ]);
  });

  it('空行しかないときもデータ 0 行として扱う', () => {
    const sheets = validSheets();
    sheets['参加者'] = [['氏名', '職種'], ['', ''], [' ']];
    expect(errorsOf(sheets)).toEqual([
      { sheet: '参加者', message: '「参加者」シートにデータの行がありません（2 行目から書いてください）' },
    ]);
  });

  it('項目シートだけが無い', () => {
    expect(errorsOf(without(validSheets(), '項目'))).toEqual([{ sheet: '項目', message: '「項目」シートがありません' }]);
  });

  it('読めないシートを参照する側の誤りは重ねて出さない', () => {
    const sheets = without(validSheets(), 'グループ', '部署');
    sheets['項目'].push(['環境', '壁', '存在しない', '存在しない部署']);
    expect(errorsOf(sheets)).toEqual([
      { sheet: 'グループ', message: '「グループ」シートがありません' },
      { sheet: '部署', message: '「部署」シートがありません' },
    ]);
  });
});

describe('buildFacilitySettings: 行の誤り', () => {
  it('必須セルの空欄（対象グループ・対象外の部署は空でよい）', () => {
    const sheets = validSheets();
    sheets['グループ'].push(['救急', '']);
    sheets['部署'].push(['', '病棟']);
    sheets['項目'].push(['', '', '病棟', '']);
    sheets['参加者'].push(['鈴木', '']);
    expect(errorsOf(sheets)).toEqual([
      { sheet: 'グループ', row: 4, message: '「回り方」が空欄です' },
      { sheet: '部署', row: 5, message: '「部署名」が空欄です' },
      { sheet: '項目', row: 5, message: '「テーマ」が空欄です' },
      { sheet: '項目', row: 5, message: '「項目」が空欄です' },
      { sheet: '参加者', row: 4, message: '「職種」が空欄です' },
    ]);
  });

  it('回り方が「毎回」「選ぶ」以外', () => {
    const sheets = validSheets();
    sheets['グループ'][2] = ['外来', '毎週'];
    expect(errorsOf(sheets)).toEqual([
      { sheet: 'グループ', row: 3, message: '回り方「毎週」は「毎回」か「選ぶ」にしてください' },
    ]);
  });

  it('グループ名・部署名・氏名の重複', () => {
    const sheets = validSheets();
    sheets['グループ'].push(['病棟', '選ぶ']);
    sheets['部署'].push(['3階東', '外来']);
    sheets['参加者'].push(['山田', '薬剤師']);
    expect(errorsOf(sheets)).toEqual([
      { sheet: 'グループ', row: 4, message: 'グループ名「病棟」が重複しています（2 行目と同じです）' },
      { sheet: '部署', row: 5, message: '部署名「3階東」が重複しています（2 行目と同じです）' },
      { sheet: '参加者', row: 4, message: '氏名「山田」が重複しています（2 行目と同じです）' },
    ]);
  });

  it('重複した行にあるほかの誤りも出す', () => {
    const sheets = validSheets();
    sheets['グループ'].push(['病棟', '毎週']);
    sheets['部署'].push(['3階東', '救急']);
    sheets['項目'].push(['手指衛生', '手指消毒剤が置いてある', '透析', '5階']);
    expect(errorsOf(sheets)).toEqual([
      { sheet: 'グループ', row: 4, message: 'グループ名「病棟」が重複しています（2 行目と同じです）' },
      { sheet: 'グループ', row: 4, message: '回り方「毎週」は「毎回」か「選ぶ」にしてください' },
      { sheet: '部署', row: 5, message: '部署名「3階東」が重複しています（2 行目と同じです）' },
      { sheet: '部署', row: 5, message: 'グループ「救急」が「グループ」シートにありません' },
      {
        sheet: '項目',
        row: 5,
        message: 'テーマ「手指衛生」の項目「手指消毒剤が置いてある」が重複しています（2 行目と同じです）',
      },
      { sheet: '項目', row: 5, message: '対象グループ「透析」が「グループ」シートにありません' },
      { sheet: '項目', row: 5, message: '対象外の部署「5階」が「部署」シートにありません' },
    ]);
  });

  it('重複した部署の行だけが属するグループを「部署が無い」とは言わない', () => {
    const sheets = validSheets();
    sheets['グループ'].push(['救急', '選ぶ']);
    sheets['部署'].push(['3階東', '救急']);
    expect(errorsOf(sheets)).toEqual([
      { sheet: '部署', row: 5, message: '部署名「3階東」が重複しています（2 行目と同じです）' },
    ]);
  });

  it('3 回以上の重複は、どれも最初の行を示す', () => {
    const sheets = validSheets();
    sheets['参加者'].push(['山田', '薬剤師'], ['山田', '技師']);
    expect(errorsOf(sheets)).toEqual([
      { sheet: '参加者', row: 4, message: '氏名「山田」が重複しています（2 行目と同じです）' },
      { sheet: '参加者', row: 5, message: '氏名「山田」が重複しています（2 行目と同じです）' },
    ]);
  });

  it('同じテーマ内の項目の重複', () => {
    const sheets = validSheets();
    sheets['項目'].push(['手指衛生', '手指消毒剤が置いてある', '病棟', '']);
    expect(errorsOf(sheets)).toEqual([
      {
        sheet: '項目',
        row: 5,
        message: 'テーマ「手指衛生」の項目「手指消毒剤が置いてある」が重複しています（2 行目と同じです）',
      },
    ]);
  });

  it('部署が存在しないグループを参照', () => {
    const sheets = validSheets();
    sheets['部署'].push(['外来ウ部署', '外来ウ']);
    expect(errorsOf(sheets)).toEqual([
      { sheet: '部署', row: 5, message: 'グループ「外来ウ」が「グループ」シートにありません' },
    ]);
  });

  it('項目が存在しないグループ・部署を参照（1 セルに複数あれば全部出す）', () => {
    const sheets = validSheets();
    sheets['項目'].push(['環境', '壁', '病棟、救急、透析', '5階']);
    expect(errorsOf(sheets)).toEqual([
      { sheet: '項目', row: 5, message: '対象グループ「救急」が「グループ」シートにありません' },
      { sheet: '項目', row: 5, message: '対象グループ「透析」が「グループ」シートにありません' },
      { sheet: '項目', row: 5, message: '対象外の部署「5階」が「部署」シートにありません' },
    ]);
  });

  it('部署が 1 つも無いグループ', () => {
    const sheets = validSheets();
    sheets['グループ'].push(['救急', '選ぶ']);
    expect(errorsOf(sheets)).toEqual([
      { sheet: 'グループ', row: 4, message: 'グループ「救急」に属する部署が「部署」シートにありません' },
    ]);
  });

  it('部署シートが読めないときは「部署が無いグループ」を出さない', () => {
    const sheets = validSheets();
    sheets['部署'] = [['部署名', 'グループ']];
    expect(errorsOf(sheets)).toEqual([
      { sheet: '部署', message: '「部署」シートにデータの行がありません（2 行目から書いてください）' },
    ]);
  });

  it('回り方が不正なグループを参照する部署は、参照の誤りを重ねて出さない', () => {
    const sheets = validSheets();
    sheets['グループ'][1] = ['病棟', 'いつも'];
    expect(errorsOf(sheets)).toEqual([
      { sheet: 'グループ', row: 2, message: '回り方「いつも」は「毎回」か「選ぶ」にしてください' },
    ]);
  });

  it('空行を飛ばしても行番号は Excel の行番号のまま', () => {
    const sheets = validSheets();
    sheets['参加者'] = [['氏名', '職種'], ['', ''], ['山田', '看護師'], [], ['  ', ''], ['山田', '']];
    expect(errorsOf(sheets)).toEqual([{ sheet: '参加者', row: 6, message: '「職種」が空欄です' }]);
  });

  it('必須セルが空の行は重複や参照の判定から外す', () => {
    const sheets = validSheets();
    sheets['部署'].push(['3階東', '']);
    expect(errorsOf(sheets)).toEqual([{ sheet: '部署', row: 5, message: '「グループ」が空欄です' }]);
  });
});

describe('buildFacilitySettings: 複数の誤り', () => {
  it('誤りを全部集め、シートの順・行の順に並べる', () => {
    const sheets = validSheets();
    sheets['参加者'].push(['山田', '医師']);
    sheets['項目'].push(['環境', '壁', '救急', '']);
    sheets['部署'].push(['救急外来', '救急']);
    sheets['グループ'].push(['検査', '毎週']);
    sheets['グループ'].push(['病棟', '毎回']);
    expect(errorsOf(sheets)).toEqual([
      { sheet: 'グループ', row: 4, message: '回り方「毎週」は「毎回」か「選ぶ」にしてください' },
      { sheet: 'グループ', row: 4, message: 'グループ「検査」に属する部署が「部署」シートにありません' },
      { sheet: 'グループ', row: 5, message: 'グループ名「病棟」が重複しています（2 行目と同じです）' },
      { sheet: '部署', row: 5, message: 'グループ「救急」が「グループ」シートにありません' },
      { sheet: '項目', row: 5, message: '対象グループ「救急」が「グループ」シートにありません' },
      { sheet: '参加者', row: 4, message: '氏名「山田」が重複しています（2 行目と同じです）' },
    ]);
  });

  it('行の誤りとシート全体の誤りもシートの順に並ぶ', () => {
    const sheets = without(validSheets(), '参加者');
    sheets['グループ'].push(['救急', '選ぶ']);
    expect(errorsOf(sheets)).toEqual([
      { sheet: 'グループ', row: 4, message: 'グループ「救急」に属する部署が「部署」シートにありません' },
      { sheet: '参加者', message: '「参加者」シートがありません' },
    ]);
  });
});
