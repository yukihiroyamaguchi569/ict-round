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
});
