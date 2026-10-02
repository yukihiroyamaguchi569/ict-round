import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryAccordion from '../../components/CategoryAccordion';
import type { ChecklistCategory, ChecklistItemResult, Rating } from '../../types';

const CATEGORY: ChecklistCategory = {
  category: '手指衛生',
  items: [
    { id: 'hand-1', category: '手指衛生', description: '手指消毒剤が配置されている' },
    { id: 'hand-2', category: '手指衛生', description: '5つのタイミングが掲示されている' },
    { id: 'hand-3', category: '手指衛生', description: '手洗い場に石けんがある' },
  ],
};

function results(ratings: Record<string, Rating>): ChecklistItemResult[] {
  return CATEGORY.items.map((item) => ({ itemId: item.id, rating: ratings[item.id] ?? null, photos: [] }));
}

function header() {
  return screen.getByRole('button', { name: /手指衛生/ });
}

describe('CategoryAccordion', () => {
  it('is closed by default and toggles items on header click', async () => {
    const user = userEvent.setup();
    render(<CategoryAccordion category={CATEGORY} results={results({})} onRatingChange={vi.fn()} />);

    expect(screen.queryByText('手指消毒剤が配置されている')).not.toBeInTheDocument();
    await user.click(header());
    expect(screen.getByText('手指消毒剤が配置されている')).toBeInTheDocument();
    await user.click(header());
    expect(screen.queryByText('手指消毒剤が配置されている')).not.toBeInTheDocument();
  });

  it('starts open when defaultOpen is true', () => {
    render(<CategoryAccordion category={CATEGORY} results={results({})} onRatingChange={vi.fn()} defaultOpen />);
    for (const item of CATEGORY.items) {
      expect(screen.getByText(item.description)).toBeInTheDocument();
    }
  });

  it('shows 0/N when nothing is rated', () => {
    render(<CategoryAccordion category={CATEGORY} results={results({})} onRatingChange={vi.fn()} />);
    expect(header()).toHaveTextContent('0/3');
  });

  it('counts only rated items', () => {
    render(
      <CategoryAccordion category={CATEGORY} results={results({ 'hand-1': 'A', 'hand-3': 'C' })} onRatingChange={vi.fn()} />,
    );
    expect(header()).toHaveTextContent('2/3');
  });

  it('shows N/N when all items are rated', () => {
    render(
      <CategoryAccordion
        category={CATEGORY}
        results={results({ 'hand-1': 'A', 'hand-2': 'B', 'hand-3': 'C' })}
        onRatingChange={vi.fn()}
      />,
    );
    expect(header()).toHaveTextContent('3/3');
  });

  it('treats items without a result entry as unrated', () => {
    render(<CategoryAccordion category={CATEGORY} results={[]} onRatingChange={vi.fn()} defaultOpen />);
    expect(header()).toHaveTextContent('0/3');
    // Rating buttons still render for every item
    expect(screen.getAllByRole('button', { name: 'A' })).toHaveLength(3);
  });

  it('passes the item id and rating to onRatingChange', async () => {
    const user = userEvent.setup();
    const onRatingChange = vi.fn();
    render(<CategoryAccordion category={CATEGORY} results={results({})} onRatingChange={onRatingChange} defaultOpen />);

    await user.click(screen.getAllByRole('button', { name: 'B' })[1]);
    expect(onRatingChange).toHaveBeenCalledTimes(1);
    expect(onRatingChange).toHaveBeenCalledWith('hand-2', 'B');
  });

  it('passes null when the current rating of an item is pressed again', async () => {
    const user = userEvent.setup();
    const onRatingChange = vi.fn();
    render(
      <CategoryAccordion category={CATEGORY} results={results({ 'hand-3': 'C' })} onRatingChange={onRatingChange} defaultOpen />,
    );

    await user.click(screen.getAllByRole('button', { name: 'C' })[2]);
    expect(onRatingChange).toHaveBeenCalledWith('hand-3', null);
  });
});
