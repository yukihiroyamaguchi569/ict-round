import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChecklistEditor from '../../components/ChecklistEditor';
import { draftFromChecklist, emptyDraft, type EditorDraft } from '../../checklistEditor';
import type { SavedChecklist } from '../../types';
import { trackEvent } from '../../analytics';

vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));

const SOURCE: SavedChecklist = {
  id: 'default',
  name: '標準チェックリスト',
  createdAt: '2026-01-01T00:00:00.000Z',
  isDefault: true,
  categories: [
    {
      category: '手指衛生',
      items: [
        { id: 'h-1', category: '手指衛生', description: '消毒剤がある' },
        { id: 'h-2', category: '手指衛生', description: '掲示がある' },
      ],
    },
    { category: '環境', items: [{ id: 'e-1', category: '環境', description: '清掃されている' }] },
  ],
};

function setup(initialDraft: EditorDraft = emptyDraft(), source: 'new' | 'copy' = 'new') {
  const onSave = vi.fn<(c: SavedChecklist) => void>();
  const onCancel = vi.fn();
  render(<ChecklistEditor initialDraft={initialDraft} source={source} onSave={onSave} onCancel={onCancel} />);
  return { onSave, onCancel, user: userEvent.setup() };
}

const button = (name: string) => screen.getByRole('button', { name });
const textbox = (name: string) => screen.getByRole('textbox', { name });

function savedChecklist(onSave: ReturnType<typeof setup>['onSave']): SavedChecklist {
  expect(onSave).toHaveBeenCalledTimes(1);
  return onSave.mock.calls[0][0];
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(trackEvent).mockClear();
});

describe('ChecklistEditor', () => {
  it('builds a new checklist from typed categories and items', async () => {
    const { onSave, onCancel, user } = setup();
    expect(screen.getByRole('heading', { name: 'チェックリストを作成' })).toBeInTheDocument();

    await user.type(textbox('チェックリストの名前'), '医療安全');
    await user.type(textbox('カテゴリ1の名前'), '転倒');
    await user.type(textbox('カテゴリ1の項目1'), '柵が上がっている');
    await user.click(button('カテゴリ1に項目を追加'));
    await user.type(textbox('カテゴリ1の項目2'), '履物が適切');
    await user.click(button('カテゴリを追加'));
    await user.type(textbox('カテゴリ2の名前'), '誤薬');
    await user.type(textbox('カテゴリ2の項目1'), '指差し確認');
    await user.click(button('保存して適用'));

    const c = savedChecklist(onSave);
    expect(onCancel).not.toHaveBeenCalled();
    expect(c.name).toBe('医療安全');
    expect(c.categories).toEqual([
      {
        category: '転倒',
        items: [
          { id: expect.stringMatching(/^item-/), category: '転倒', description: '柵が上がっている' },
          { id: expect.stringMatching(/^item-/), category: '転倒', description: '履物が適切' },
        ],
      },
      { category: '誤薬', items: [{ id: expect.stringMatching(/^item-/), category: '誤薬', description: '指差し確認' }] },
    ]);
  });

  it('shows the copied content and keeps item IDs on save', async () => {
    const { onSave, user } = setup(draftFromChecklist(SOURCE, '標準チェックリストのコピー'), 'copy');
    expect(screen.getByRole('heading', { name: 'チェックリストを複製して編集' })).toBeInTheDocument();
    expect(textbox('チェックリストの名前')).toHaveValue('標準チェックリストのコピー');
    expect(textbox('カテゴリ1の項目2')).toHaveValue('掲示がある');

    await user.click(button('保存して適用'));
    const c = savedChecklist(onSave);
    expect(c.categories.flatMap((cat) => cat.items.map((i) => i.id))).toEqual(['h-1', 'h-2', 'e-1']);
  });

  it('does not move focus to an input when the editor opens', () => {
    setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    expect(document.activeElement).toBe(document.body);
  });

  it('focuses the new item input after adding an item', async () => {
    const { user } = setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    await user.click(button('カテゴリ1に項目を追加'));
    expect(textbox('カテゴリ1の項目3')).toHaveFocus();
  });

  it('focuses the new category name input after adding a category', async () => {
    const { user } = setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    await user.click(button('カテゴリを追加'));
    expect(textbox('カテゴリ3の名前')).toHaveFocus();
  });

  it('does not steal focus when moving a newly added item', async () => {
    const { user } = setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    await user.click(button('カテゴリ1に項目を追加'));
    await user.click(button('カテゴリ1の項目3を上へ移動'));
    expect(button('カテゴリ1の項目2を上へ移動')).toHaveFocus();
  });

  it('reorders items and categories with the arrow buttons', async () => {
    const { onSave, user } = setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    expect(button('カテゴリ1の項目1を上へ移動')).toBeDisabled();
    expect(button('カテゴリ1の項目2を下へ移動')).toBeDisabled();
    expect(button('カテゴリ1を上へ移動')).toBeDisabled();
    expect(button('カテゴリ2を下へ移動')).toBeDisabled();

    await user.click(button('カテゴリ1の項目2を上へ移動'));
    expect(textbox('カテゴリ1の項目1')).toHaveValue('掲示がある');
    await user.click(button('カテゴリ2を上へ移動'));
    expect(textbox('カテゴリ1の名前')).toHaveValue('環境');

    await user.click(button('保存して適用'));
    const c = savedChecklist(onSave);
    expect(c.categories.map((cat) => cat.category)).toEqual(['環境', '手指衛生']);
    expect(c.categories[1].items.map((i) => i.description)).toEqual(['掲示がある', '消毒剤がある']);
  });

  it('deletes an item without asking', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { onSave, user } = setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    await user.click(button('カテゴリ1の項目1を削除'));
    expect(confirmSpy).not.toHaveBeenCalled();
    await user.click(button('保存して適用'));
    expect(savedChecklist(onSave).categories[0].items.map((i) => i.id)).toEqual(['h-2']);
  });

  it('asks before deleting a category with items and keeps it when declined', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    await user.click(button('カテゴリ1を削除'));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(textbox('カテゴリ1の名前')).toHaveValue('手指衛生');
  });

  it('deletes a category with items when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onSave, user } = setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    await user.click(button('カテゴリ1を削除'));
    expect(textbox('カテゴリ1の名前')).toHaveValue('環境');
    expect(screen.queryByRole('textbox', { name: 'カテゴリ2の名前' })).not.toBeInTheDocument();
    await user.click(button('保存して適用'));
    expect(savedChecklist(onSave).categories.map((cat) => cat.category)).toEqual(['環境']);
  });

  it('deletes a category with only blank items without asking', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { user } = setup();
    await user.click(button('カテゴリ1を削除'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'カテゴリ1の名前' })).not.toBeInTheDocument();
  });

  it('shows the validation error and does not save', async () => {
    const { onSave, user } = setup();
    await user.click(button('保存して適用'));
    expect(screen.getByRole('alert')).toHaveTextContent('チェックリストの名前を入力してください。');

    await user.type(textbox('チェックリストの名前'), '名前');
    await user.click(button('保存して適用'));
    expect(screen.getByRole('alert')).toHaveTextContent('点検項目を1つ以上入力してください。');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows a duplicate category error', async () => {
    const { onSave, user } = setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    await user.clear(textbox('カテゴリ2の名前'));
    await user.type(textbox('カテゴリ2の名前'), '手指衛生');
    await user.click(button('保存して適用'));
    expect(screen.getByRole('alert')).toHaveTextContent('カテゴリ名「手指衛生」が重複しています');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancels without asking when nothing was changed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { onCancel, onSave, user } = setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    await user.click(button('キャンセル'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('stays open when cancelling unsaved edits is declined', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onCancel, user } = setup();
    await user.type(textbox('チェックリストの名前'), 'x');
    await user.click(button('キャンセル'));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(textbox('チェックリストの名前')).toHaveValue('x');
  });

  it('closes when cancelling unsaved edits is confirmed, also from the close button', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onCancel, onSave, user } = setup();
    await user.type(textbox('カテゴリ1の項目1'), 'x');
    await user.click(button('閉じる'));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('records the open event once with its source', async () => {
    const { user } = setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    expect(vi.mocked(trackEvent).mock.calls).toEqual([['checklist_editor_open', { source: 'copy' }]]);
    // Editing re-renders but must not record the open event again
    await user.type(textbox('チェックリストの名前'), 'x');
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('records the open event for a new checklist', () => {
    setup();
    expect(vi.mocked(trackEvent).mock.calls).toEqual([['checklist_editor_open', { source: 'new' }]]);
  });

  it('records the save event only when the checklist is saved', async () => {
    const { onSave, user } = setup();
    await user.click(button('保存して適用'));
    expect(trackEvent).not.toHaveBeenCalledWith('checklist_editor_save');

    await user.type(textbox('チェックリストの名前'), '名前');
    await user.type(textbox('カテゴリ1の名前'), '転倒');
    await user.type(textbox('カテゴリ1の項目1'), '柵');
    await user.click(button('保存して適用'));
    expect(trackEvent).toHaveBeenLastCalledWith('checklist_editor_save');
    expect(trackEvent).toHaveBeenCalledTimes(2);
    expect(savedChecklist(onSave).name).toBe('名前');
  });

  it('does not record a save event when cancelling', async () => {
    const { onCancel, user } = setup();
    await user.click(button('キャンセル'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(vi.mocked(trackEvent).mock.calls).toEqual([['checklist_editor_open', { source: 'new' }]]);
  });

  it('cancels without asking when edits were reverted to the initial content', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    const { onCancel, user } = setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    await user.type(textbox('チェックリストの名前'), 'x');
    await user.type(textbox('チェックリストの名前'), '{Backspace}');
    await user.click(button('キャンセル'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('asks before cancelling after a category was added', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { onCancel, user } = setup(draftFromChecklist(SOURCE, 'コピー'), 'copy');
    await user.click(button('カテゴリを追加'));
    await user.click(button('閉じる'));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
