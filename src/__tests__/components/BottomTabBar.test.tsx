import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BottomTabBar from '../../components/BottomTabBar';

type Props = Parameters<typeof BottomTabBar>[0];

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    activeTab: 'checklist',
    onTabChange: vi.fn(),
    onReport: vi.fn(),
    photoCount: 0,
    hasEvaluation: false,
    ...overrides,
  };
  render(<BottomTabBar {...props} />);
  return { props, user: userEvent.setup() };
}

function tab(label: string) {
  return screen.getByRole('button', { name: new RegExp(label) });
}

describe('BottomTabBar', () => {
  it.each([
    ['チェック', 'checklist'],
    ['写真', 'photos'],
    ['総評', 'evaluation'],
  ])('calls onTabChange with the id of the %s tab', async (label, id) => {
    const { props, user } = setup();
    await user.click(tab(label));
    expect(props.onTabChange).toHaveBeenCalledTimes(1);
    expect(props.onTabChange).toHaveBeenCalledWith(id);
    expect(props.onReport).not.toHaveBeenCalled();
  });

  it.each([
    ['checklist', 'チェック'],
    ['photos', '写真'],
    ['evaluation', '総評'],
  ] as const)('marks only the %s tab as current', (activeTab, label) => {
    setup({ activeTab });
    for (const other of ['チェック', '写真', '総評']) {
      if (other === label) {
        expect(tab(other)).toHaveAttribute('aria-current', 'page');
      } else {
        expect(tab(other)).not.toHaveAttribute('aria-current');
      }
    }
    expect(screen.getByRole('button', { name: 'レポート' })).not.toHaveAttribute('aria-current');
  });

  it('calls only onReport when the report button is pressed', async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole('button', { name: 'レポート' }));
    expect(props.onReport).toHaveBeenCalledTimes(1);
    expect(props.onTabChange).not.toHaveBeenCalled();
  });

  it('shows no photo badge when there are no photos', () => {
    setup({ photoCount: 0 });
    expect(tab('写真')).toHaveTextContent(/^写真$/);
  });

  it('shows the photo count badge when there are photos', () => {
    setup({ photoCount: 3 });
    expect(tab('写真')).toHaveTextContent('3写真');
  });

  it('does not show the photo count on other tabs', () => {
    setup({ photoCount: 3 });
    expect(tab('チェック')).toHaveTextContent(/^チェック$/);
    expect(tab('総評')).toHaveTextContent(/^総評$/);
  });

  it('shows the evaluation check mark only when an evaluation exists', () => {
    const { unmount } = render(
      <BottomTabBar activeTab="checklist" onTabChange={vi.fn()} onReport={vi.fn()} photoCount={0} hasEvaluation={false} />,
    );
    const iconCountWithout = tab('総評').querySelectorAll('svg').length;
    unmount();

    setup({ hasEvaluation: true });
    expect(tab('総評').querySelectorAll('svg')).toHaveLength(iconCountWithout + 1);
  });
});
