import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WhatsNewDialog from '../../components/WhatsNewDialog';
import type { Release } from '../../whatsNew';

const RELEASES: Release[] = [
  { version: '1.14.0', date: '2026-09-20', changes: ['新しい機能A', '改善B'] },
  { version: '1.13.0', date: '2026-09-01', changes: ['修正C'] },
];

function setup(releases: Release[] = RELEASES) {
  const onClose = vi.fn();
  render(<WhatsNewDialog releases={releases} onClose={onClose} />);
  return { onClose, user: userEvent.setup() };
}

describe('WhatsNewDialog', () => {
  it('shows each release with its version, date and changes', () => {
    setup();
    const dialog = screen.getByRole('dialog', { name: '新機能のお知らせ' });
    expect(within(dialog).getByRole('heading', { name: 'v1.14.0（2026-09-20）' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { name: 'v1.13.0（2026-09-01）' })).toBeInTheDocument();
    expect(within(dialog).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '新しい機能A',
      '改善B',
      '修正C',
    ]);
  });

  it('links to the full update history in a new tab', () => {
    setup();
    const link = screen.getByRole('link', { name: '更新履歴をすべて見る' });
    expect(link).toHaveAttribute('href', expect.stringMatching(/updates\/$/));
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('moves focus into the dialog on open', () => {
    setup();
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('calls onClose when 閉じる is pressed', async () => {
    const { onClose, user } = setup();
    await user.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose on Escape', async () => {
    const { onClose, user } = setup();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores keys other than Escape', async () => {
    const { onClose, user } = setup();
    await user.keyboard('{Enter}a{Tab}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stops listening for Escape after unmount', async () => {
    const onClose = vi.fn();
    const { unmount } = render(<WhatsNewDialog releases={RELEASES} onClose={onClose} />);
    unmount();
    await userEvent.setup().keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});
