import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChecklistEditor from '../../components/ChecklistEditor';
import { emptyDraft, type EditorDraft } from '../../checklistEditor';
import type { SavedChecklist } from '../../types';
import { trackEvent } from '../../analytics';

vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));

const OPEN = '表のテキストを貼り付けて読み込む';
const TABLE = '手指衛生\t消毒剤がある．\tA\n\t掲示がある．\tB\n環境\t清掃されている．\tA';
const LINES = '■手指衛生\n消毒剤がある．\nA\n■環境\n清掃されている． B';

function setup(initialDraft: EditorDraft = emptyDraft()) {
  const onSave = vi.fn<(c: SavedChecklist) => void>();
  const onCancel = vi.fn();
  render(<ChecklistEditor initialDraft={initialDraft} source="new" onSave={onSave} onCancel={onCancel} />);
  return { onSave, onCancel, user: userEvent.setup() };
}

const button = (name: string) => screen.getByRole('button', { name });
const textbox = (name: string) => screen.getByRole('textbox', { name });

async function openAndPaste(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.click(button(OPEN));
  await user.click(textbox('貼り付けるテキスト'));
  await user.paste(text);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(trackEvent).mockClear();
});

describe('ChecklistEditor text import', () => {
  it('opens the paste panel from the button under the name field', async () => {
    const { user } = setup();
    expect(screen.queryByRole('textbox', { name: '貼り付けるテキスト' })).not.toBeInTheDocument();
    await user.click(button(OPEN));
    expect(screen.getByRole('region', { name: OPEN })).toBeInTheDocument();
    expect(textbox('貼り付けるテキスト')).toBeInTheDocument();
    expect(button('読み込む')).toBeDisabled();
    expect(screen.getByText(/行頭に ■ を付けた行はカテゴリになります/)).toBeInTheDocument();
  });

  it('previews how pasted text is split, and updates it when the text is edited', async () => {
    const { user } = setup();
    await openAndPaste(user, TABLE);
    const preview = screen.getByRole('region', { name: '振り分けの結果' });
    expect(within(preview).getByText('2カテゴリ・3項目')).toBeInTheDocument();
    expect(within(preview).getByText('手指衛生')).toBeInTheDocument();
    expect(within(preview).getByText('・掲示がある．')).toBeInTheDocument();

    await user.type(textbox('貼り付けるテキスト'), '\n■ 薬品\n期限切れがない．');
    expect(within(preview).getByText('3カテゴリ・4項目')).toBeInTheDocument();
    expect(within(preview).getByText('薬品')).toBeInTheDocument();
  });

  it('shows items without a category under a placeholder name, and a category without items as such', async () => {
    const { user } = setup();
    await openAndPaste(user, '消毒剤がある．\n手袋交換');
    expect(screen.getByText('（カテゴリ名なし）')).toBeInTheDocument();
    expect(screen.getByText('手袋交換')).toBeInTheDocument();
    expect(screen.getByText('（項目なし）')).toBeInTheDocument();
    expect(screen.getByText('2カテゴリ・1項目')).toBeInTheDocument();
  });

  it('replaces an empty draft on import, closes the panel and sends only the format', async () => {
    const { onSave, user } = setup();
    await openAndPaste(user, TABLE);
    await user.click(button('読み込む'));

    expect(screen.queryByRole('region', { name: OPEN })).not.toBeInTheDocument();
    expect(textbox('カテゴリ1の名前')).toHaveValue('手指衛生');
    expect(textbox('カテゴリ1の項目2')).toHaveValue('掲示がある．');
    expect(textbox('カテゴリ2の名前')).toHaveValue('環境');
    expect(screen.queryByRole('textbox', { name: 'カテゴリ3の名前' })).not.toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('checklist_text_import', { format: 'table' });

    await user.type(textbox('チェックリストの名前'), '取り込み');
    await user.click(button('保存して適用'));
    expect(onSave.mock.calls[0][0].categories.map((c) => [c.category, c.items.length])).toEqual([
      ['手指衛生', 2],
      ['環境', 1],
    ]);
  });

  it('appends to a draft that already has content', async () => {
    const draft: EditorDraft = {
      name: '医療安全',
      categories: [{ key: 'x', name: '転倒', items: [{ key: 'y', description: '柵が上がっている' }] }],
    };
    const { user } = setup(draft);
    await openAndPaste(user, LINES);
    await user.click(button('読み込む'));

    expect(textbox('カテゴリ1の名前')).toHaveValue('転倒');
    expect(textbox('カテゴリ2の名前')).toHaveValue('手指衛生');
    expect(textbox('カテゴリ3の名前')).toHaveValue('環境');
    expect(textbox('カテゴリ3の項目1')).toHaveValue('清掃されている．');
    expect(trackEvent).toHaveBeenCalledWith('checklist_text_import', { format: 'lines' });
  });

  it('closes without changing the draft or sending the event', async () => {
    const { user } = setup();
    await openAndPaste(user, TABLE);
    await user.click(button('やめる'));

    expect(textbox('カテゴリ1の名前')).toHaveValue('');
    expect(trackEvent).not.toHaveBeenCalledWith('checklist_text_import', expect.anything());
    await user.click(button(OPEN));
    expect(textbox('貼り付けるテキスト')).toHaveValue('');
  });

  it('asks before closing the editor with pasted text not yet imported, and stays open when declined', async () => {
    const { onCancel, user } = setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await openAndPaste(user, TABLE);
    await user.click(button('キャンセル'));

    expect(confirmSpy).toHaveBeenCalledWith('編集内容を破棄して閉じますか？');
    expect(onCancel).not.toHaveBeenCalled();
    expect(textbox('貼り付けるテキスト')).toHaveValue(TABLE);

    confirmSpy.mockReturnValue(true);
    await user.click(button('閉じる'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('closes the editor without asking when the panel is open but empty', async () => {
    const { onCancel, user } = setup();
    const confirmSpy = vi.spyOn(window, 'confirm');
    await openAndPaste(user, ' \n ');
    await user.click(button('キャンセル'));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('keeps 読み込む disabled while the text has no items', async () => {
    const { user } = setup();
    await openAndPaste(user, 'ジャンル\nA\n- 1 -');
    expect(button('読み込む')).toBeDisabled();
    expect(screen.queryByRole('region', { name: '振り分けの結果' })).not.toBeInTheDocument();
  });
});
