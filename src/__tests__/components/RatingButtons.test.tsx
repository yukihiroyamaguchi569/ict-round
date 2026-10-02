import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RatingButtons from '../../components/RatingButtons';
import type { Rating } from '../../types';

function setup(value: Rating) {
  const onChange = vi.fn();
  render(<RatingButtons value={value} onChange={onChange} />);
  return { onChange, user: userEvent.setup() };
}

describe('RatingButtons', () => {
  it('renders A / B / C buttons', () => {
    setup(null);
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['A', 'B', 'C']);
  });

  it.each(['A', 'B', 'C'] as const)('selects %s when nothing is selected', async (r) => {
    const { onChange, user } = setup(null);
    await user.click(screen.getByRole('button', { name: r }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(r);
  });

  it('clears the rating when the selected button is pressed again', async () => {
    const { onChange, user } = setup('B');
    await user.click(screen.getByRole('button', { name: 'B' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('switches to another rating instead of clearing when a different button is pressed', async () => {
    const { onChange, user } = setup('A');
    await user.click(screen.getByRole('button', { name: 'C' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('C');
  });

  it('does not call onChange without a click', () => {
    const { onChange } = setup('A');
    expect(onChange).not.toHaveBeenCalled();
  });
});
