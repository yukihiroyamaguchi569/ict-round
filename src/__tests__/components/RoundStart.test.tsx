import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoundStart from '../../components/RoundStart';
import { ThemeProvider } from '../../ThemeContext';
import { IconProvider } from '../../IconContext';
import type { SavedChecklist } from '../../types';

const LIBRARY: SavedChecklist[] = [
  {
    id: 'default',
    name: '標準チェックリスト',
    createdAt: '2026-01-01T00:00:00.000Z',
    isDefault: true,
    categories: [{ category: '手指衛生', items: [{ id: 'h-1', category: '手指衛生', description: '消毒剤' }] }],
  },
  {
    id: 'custom',
    name: '外来用',
    createdAt: '2026-02-01T00:00:00.000Z',
    categories: [{ category: '環境', items: [{ id: 'e-1', category: '環境', description: '清掃' }] }],
  },
];

type Props = Parameters<typeof RoundStart>[0];

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    library: LIBRARY,
    activeId: 'default',
    savedRoundsCount: 0,
    initialName: '',
    onStart: vi.fn(),
    onStartSample: vi.fn(() => Promise.resolve()),
    onSelectChecklist: vi.fn(),
    onAddChecklist: vi.fn(),
    onDeleteChecklist: vi.fn(),
    onViewSaved: vi.fn(),
    ...overrides,
  };
  render(
    <ThemeProvider>
      <IconProvider>
        <RoundStart {...props} />
      </IconProvider>
    </ThemeProvider>,
  );
  return { props, user: userEvent.setup() };
}

function startButton() {
  return screen.getByRole('button', { name: 'ラウンド開始' });
}

function nameInput() {
  return screen.getByPlaceholderText('例: 山田 花子');
}

function wardInput() {
  return screen.getByPlaceholderText('例: 3階東病棟');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RoundStart', () => {
  it('disables start while the name is empty', () => {
    setup();
    expect(startButton()).toBeDisabled();
  });

  it('keeps start disabled for a whitespace-only name and does not call onStart on submit', async () => {
    const { props, user } = setup();
    await user.type(nameInput(), '   ');
    expect(startButton()).toBeDisabled();
    // Submit the form directly so the guard in handleSubmit is exercised, not just the disabled button
    const form = startButton().closest('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);
    expect(props.onStart).not.toHaveBeenCalled();
  });

  it('passes trimmed name and ward name to onStart', async () => {
    const { props, user } = setup();
    await user.type(nameInput(), '  山田 花子 ');
    await user.type(wardInput(), ' 3階東病棟  ');
    expect(startButton()).toBeEnabled();
    await user.click(startButton());
    expect(props.onStart).toHaveBeenCalledTimes(1);
    expect(props.onStart).toHaveBeenCalledWith('山田 花子', '3階東病棟');
  });

  it('passes an empty ward name when it is left blank', async () => {
    const { props, user } = setup();
    await user.type(nameInput(), '山田');
    await user.click(startButton());
    expect(props.onStart).toHaveBeenCalledWith('山田', '');
  });

  it('starts with Enter in the name field', async () => {
    const { props, user } = setup();
    await user.type(nameInput(), '山田{Enter}');
    expect(props.onStart).toHaveBeenCalledTimes(1);
    expect(props.onStart).toHaveBeenCalledWith('山田', '');
  });

  it('prefills the name from initialName so start is enabled immediately', async () => {
    const { props, user } = setup({ initialName: '佐藤' });
    expect(nameInput()).toHaveValue('佐藤');
    await user.click(startButton());
    expect(props.onStart).toHaveBeenCalledWith('佐藤', '');
  });

  it('disables start again when the name is cleared', async () => {
    const { props, user } = setup({ initialName: '佐藤' });
    await user.clear(nameInput());
    expect(startButton()).toBeDisabled();
    expect(props.onStart).not.toHaveBeenCalled();
  });

  it('opens the saved rounds list without starting a round', async () => {
    const { props, user } = setup({ initialName: '佐藤' });
    await user.click(screen.getByRole('button', { name: /保存済みラウンドを開く/ }));
    expect(props.onViewSaved).toHaveBeenCalledTimes(1);
    expect(props.onStart).not.toHaveBeenCalled();
  });

  it('selects a checklist when its row is clicked', async () => {
    const { props, user } = setup();
    await user.click(screen.getByText('外来用'));
    expect(props.onSelectChecklist).toHaveBeenCalledTimes(1);
    expect(props.onSelectChecklist).toHaveBeenCalledWith('custom');
    expect(props.onDeleteChecklist).not.toHaveBeenCalled();
  });

  it('keeps the checklist when deletion is cancelled in the confirm dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { props, user } = setup();
    await user.click(screen.getAllByRole('button', { name: '削除' })[1]);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(props.onDeleteChecklist).not.toHaveBeenCalled();
    expect(props.onSelectChecklist).not.toHaveBeenCalled();
  });

  it('deletes the checklist when the confirm dialog is accepted, without selecting it', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { props, user } = setup();
    await user.click(screen.getAllByRole('button', { name: '削除' })[1]);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(props.onDeleteChecklist).toHaveBeenCalledTimes(1);
    expect(props.onDeleteChecklist).toHaveBeenCalledWith('custom');
    expect(props.onSelectChecklist).not.toHaveBeenCalled();
  });

  it('offers no delete button when only one checklist is left', () => {
    setup({ library: LIBRARY.slice(0, 1) });
    expect(screen.queryByRole('button', { name: '削除' })).not.toBeInTheDocument();
  });

  it('adds an imported checklist, then selects it and closes the dialog', async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole('button', { name: '新しいチェックリストを追加する' }));
    await user.click(screen.getByRole('button', { name: 'ファイルから取り込む' }));
    expect(screen.getByRole('heading', { name: 'チェックリストを取り込む' })).toBeInTheDocument();

    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error('file input not found');
    await user.upload(fileInput, new File(['手指衛生,消毒剤がある'], 'ward.csv', { type: 'text/csv' }));
    await screen.findByText('プレビュー');
    await user.click(screen.getByRole('button', { name: '保存して適用' }));

    expect(props.onAddChecklist).toHaveBeenCalledTimes(1);
    const added: SavedChecklist = vi.mocked(props.onAddChecklist).mock.calls[0][0];
    expect(added.name).toBe('ward');
    expect(props.onSelectChecklist).toHaveBeenCalledTimes(1);
    expect(props.onSelectChecklist).toHaveBeenCalledWith(added.id);
    // The new checklist must exist in the library before it is selected
    expect(vi.mocked(props.onAddChecklist).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(props.onSelectChecklist).mock.invocationCallOrder[0],
    );
    expect(screen.queryByRole('heading', { name: 'チェックリストを取り込む' })).not.toBeInTheDocument();
  });

  it('offers to create on screen or import a file, without opening either yet', async () => {
    const { user } = setup();
    const addButton = screen.getByRole('button', { name: '新しいチェックリストを追加する' });
    expect(screen.queryByRole('button', { name: '画面で作成する' })).not.toBeInTheDocument();

    await user.click(addButton);
    expect(addButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: '画面で作成する' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ファイルから取り込む' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'チェックリストを取り込む' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'チェックリストを作成' })).not.toBeInTheDocument();

    // A second click closes the options again
    await user.click(addButton);
    expect(screen.queryByRole('button', { name: '画面で作成する' })).not.toBeInTheDocument();
  });

  it('creates a checklist on screen, then adds and selects it and closes the editor', async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole('button', { name: '新しいチェックリストを追加する' }));
    await user.click(screen.getByRole('button', { name: '画面で作成する' }));
    expect(screen.getByRole('heading', { name: 'チェックリストを作成' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'チェックリストの名前' })).toHaveValue('');

    await user.type(screen.getByRole('textbox', { name: 'チェックリストの名前' }), '医療安全');
    await user.type(screen.getByRole('textbox', { name: 'カテゴリ1の名前' }), '転倒');
    await user.type(screen.getByRole('textbox', { name: 'カテゴリ1の項目1' }), '柵が上がっている');
    await user.click(screen.getByRole('button', { name: '保存して適用' }));

    expect(props.onAddChecklist).toHaveBeenCalledTimes(1);
    const added: SavedChecklist = vi.mocked(props.onAddChecklist).mock.calls[0][0];
    expect(added.name).toBe('医療安全');
    expect(props.onSelectChecklist).toHaveBeenCalledWith(added.id);
    expect(vi.mocked(props.onAddChecklist).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(props.onSelectChecklist).mock.invocationCallOrder[0],
    );
    expect(screen.queryByRole('heading', { name: 'チェックリストを作成' })).not.toBeInTheDocument();
  });

  it('opens the editor with a copy of the checklist without selecting the row', async () => {
    const { props, user } = setup();
    await user.click(screen.getAllByRole('button', { name: '複製して編集' })[1]);
    expect(props.onSelectChecklist).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'チェックリストを複製して編集' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'チェックリストの名前' })).toHaveValue('外来用のコピー');
    expect(screen.getByRole('textbox', { name: 'カテゴリ1の名前' })).toHaveValue('環境');
    expect(screen.getByRole('textbox', { name: 'カテゴリ1の項目1' })).toHaveValue('清掃');
  });

  it('adds the copy as a new checklist and leaves the original untouched', async () => {
    const { props, user } = setup();
    await user.click(screen.getAllByRole('button', { name: '複製して編集' })[0]);
    await user.click(screen.getByRole('button', { name: '保存して適用' }));

    const added: SavedChecklist = vi.mocked(props.onAddChecklist).mock.calls[0][0];
    expect(added.id).not.toBe('default');
    expect(added.isDefault).toBeUndefined();
    expect(added.name).toBe('標準チェックリストのコピー');
    expect(added.categories).toEqual(LIBRARY[0].categories);
    expect(props.onDeleteChecklist).not.toHaveBeenCalled();
    expect(props.onSelectChecklist).toHaveBeenCalledWith(added.id);
  });

  it('offers copy even when only one checklist is left', () => {
    setup({ library: LIBRARY.slice(0, 1) });
    expect(screen.getByRole('button', { name: '複製して編集' })).toBeInTheDocument();
  });

  it('marks only the active checklist row as selected', () => {
    setup({ activeId: 'custom' });
    const row = (name: string) => screen.getByText(name).closest<HTMLElement>('.cursor-pointer');
    // jsdom drops var() inside the border shorthand, so read the inline style attribute
    expect(row('外来用')?.getAttribute('style')).toContain('border: 1.5px solid var(--t-primary)');
    expect(row('標準チェックリスト')?.getAttribute('style')).toContain('border: 1.5px solid var(--t-line)');
    // The radio dot is drawn only inside the selected row
    expect(row('外来用')?.querySelector('.bg-white')).not.toBeNull();
    expect(row('標準チェックリスト')?.querySelector('.bg-white')).toBeNull();
  });

  it('shows the item counts and marks the default checklist', () => {
    setup();
    expect(screen.getAllByText(/1カテゴリ・1項目/)).toHaveLength(2);
    expect(screen.getAllByText('（標準）')).toHaveLength(1);
  });

  it('reports the add options as collapsed until they are opened', async () => {
    const { user } = setup();
    const addButton = screen.getByRole('button', { name: '新しいチェックリストを追加する' });
    expect(addButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(addButton);
    expect(addButton).toHaveAttribute('aria-expanded', 'true');
    await user.click(addButton);
    expect(addButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses the add options when the editor is opened from them', async () => {
    const { user } = setup();
    const addButton = screen.getByRole('button', { name: '新しいチェックリストを追加する' });
    await user.click(addButton);
    await user.click(screen.getByRole('button', { name: '画面で作成する' }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(screen.queryByRole('heading', { name: 'チェックリストを作成' })).not.toBeInTheDocument();
    expect(addButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: '画面で作成する' })).not.toBeInTheDocument();
  });

  it('collapses the add options and closes the import dialog on cancel without adding anything', async () => {
    const { props, user } = setup();
    const addButton = screen.getByRole('button', { name: '新しいチェックリストを追加する' });
    await user.click(addButton);
    await user.click(screen.getByRole('button', { name: 'ファイルから取り込む' }));
    expect(addButton).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(screen.queryByRole('heading', { name: 'チェックリストを取り込む' })).not.toBeInTheDocument();
    expect(props.onAddChecklist).not.toHaveBeenCalled();
    expect(props.onSelectChecklist).not.toHaveBeenCalled();
  });

  // .animate-page keeps its transform after the animation, which would make it the containing block of
  // the dialogs' position: fixed and shrink them to the max-w-sm column instead of the whole screen
  it.each([
    ['the import dialog', 'チェックリストを取り込む', ['新しいチェックリストを追加する', 'ファイルから取り込む']],
    ['the editor for a new checklist', 'チェックリストを作成', ['新しいチェックリストを追加する', '画面で作成する']],
    ['the editor for a copy', 'チェックリストを複製して編集', ['複製して編集']],
  ])('renders %s as a direct child of the screen root, outside .animate-page', async (_, heading, clicks) => {
    const { user } = setup();
    for (const name of clicks) await user.click(screen.getAllByRole('button', { name })[0]);
    const dialog = screen.getByRole('heading', { name: heading }).closest('.fixed.inset-0');
    if (!dialog) throw new Error('dialog not found');
    expect(dialog.closest('.animate-page')).toBeNull();
    expect(dialog.parentElement).toBe(document.querySelector('.animate-page')?.parentElement);
  });

  it('shows the saved rounds count only when there are saved rounds', () => {
    setup({ savedRoundsCount: 3 });
    expect(screen.getByRole('button', { name: /保存済みラウンドを開く/ })).toHaveTextContent(/保存済みラウンドを開く\s*3$/);
  });

  it('shows no saved rounds count when there are none', () => {
    setup({ savedRoundsCount: 0 });
    expect(screen.getByRole('button', { name: /保存済みラウンドを開く/ })).toHaveTextContent(/保存済みラウンドを開く$/);
  });

  it('links to the merge page in a new tab', () => {
    setup();
    const link = screen.getByRole('link', { name: '開く' });
    expect(link).toHaveAttribute('href', './merge.html');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
    expect(screen.getByText('複数部署のレポートを統合')).toBeInTheDocument();
  });

  it('shows the app name with the version and build date', () => {
    setup();
    expect(screen.getByText(`ICTラウンドアプリ「めぐる君」 v${__APP_VERSION__} (build ${__BUILD_DATE__})`)).toBeInTheDocument();
  });

  it('closes the editor on cancel without adding anything', async () => {
    const { props, user } = setup();
    await user.click(screen.getAllByRole('button', { name: '複製して編集' })[0]);
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(screen.queryByRole('heading', { name: 'チェックリストを複製して編集' })).not.toBeInTheDocument();
    expect(props.onAddChecklist).not.toHaveBeenCalled();
    expect(props.onSelectChecklist).not.toHaveBeenCalled();
  });
});

describe('RoundStart sample button', () => {
  it('shows one prominent sample button while there are no saved rounds', () => {
    setup({ savedRoundsCount: 0 });
    const buttons = screen.getAllByRole('button', { name: /サンプルで試す/ });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName(/入力済みの例で報告書の出力まで試せます（保存されません）/);
  });

  it('moves the sample to the quiet links, before the user guide, once rounds are saved', () => {
    setup({ savedRoundsCount: 2 });
    const buttons = screen.getAllByRole('button', { name: /サンプルで試す/ });
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAccessibleName('サンプルで試す');
    const guide = screen.getByRole('link', { name: '使い方' });
    expect(buttons[0].parentElement).toBe(guide.parentElement);
    expect(buttons[0].compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('starts the sample without starting a normal round', async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole('button', { name: /サンプルで試す/ }));
    expect(props.onStartSample).toHaveBeenCalledTimes(1);
    expect(props.onStart).not.toHaveBeenCalled();
  });

  it('is disabled while the sample loads, and usable again if the sample did not open', async () => {
    let finish: () => void = () => {};
    const onStartSample = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { user } = setup({ onStartSample, savedRoundsCount: 3 });

    await user.click(screen.getByRole('button', { name: 'サンプルで試す' }));
    const pending = screen.getByRole('button', { name: '準備中…' });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(onStartSample).toHaveBeenCalledTimes(1);

    finish();
    expect(await screen.findByRole('button', { name: 'サンプルで試す' })).toBeEnabled();
  });
});
