import { describe, it, expect, vi } from 'vitest';
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
});
