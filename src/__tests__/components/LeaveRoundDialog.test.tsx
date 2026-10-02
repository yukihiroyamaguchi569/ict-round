import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LeaveRoundDialog from '../../components/LeaveRoundDialog';

function setup() {
  const callbacks = { onSaveAndLeave: vi.fn(), onLeave: vi.fn(), onCancel: vi.fn() };
  render(<LeaveRoundDialog {...callbacks} />);
  return { callbacks, user: userEvent.setup() };
}

describe('LeaveRoundDialog', () => {
  it('shows the unsaved-changes message', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'トップ画面に戻りますか？' })).toBeInTheDocument();
    expect(screen.getByText('このラウンドには保存されていない変更があります。')).toBeInTheDocument();
  });

  it.each([
    ['保存して戻る', 'onSaveAndLeave'],
    ['保存せずに戻る', 'onLeave'],
    ['キャンセル', 'onCancel'],
  ] as const)('"%s" calls only %s', async (label, expected) => {
    const { callbacks, user } = setup();
    await user.click(screen.getByRole('button', { name: label }));
    for (const [key, fn] of Object.entries(callbacks)) {
      expect(fn).toHaveBeenCalledTimes(key === expected ? 1 : 0);
    }
  });

  it('calls nothing on render', () => {
    const { callbacks } = setup();
    for (const fn of Object.values(callbacks)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});
