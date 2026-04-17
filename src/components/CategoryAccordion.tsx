import { useState } from 'react';
import type { Rating, ChecklistItemResult, ChecklistCategory } from '../types';
import RatingButtons from './RatingButtons';

interface Props {
  category: ChecklistCategory;
  results: ChecklistItemResult[];
  onRatingChange: (itemId: string, rating: Rating) => void;
  defaultOpen?: boolean;
}

export default function CategoryAccordion({
  category,
  results,
  onRatingChange,
  defaultOpen = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const ratedCount = category.items.filter((item) => {
    const result = results.find((r) => r.itemId === item.id);
    return result?.rating !== null && result?.rating !== undefined;
  }).length;

  const totalCount = category.items.length;
  const allDone = ratedCount === totalCount;

  return (
    <div
      className="card overflow-hidden"
      style={allDone ? { borderLeft: '3px solid #059669' } : {}}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex-1 min-w-0">
          <span className="font-bold text-sm text-text">{category.category}</span>
        </div>
        <span
          className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
          style={
            allDone
              ? { backgroundColor: '#059669', color: '#fff' }
              : { backgroundColor: 'var(--t-primary-light)', color: 'var(--t-primary)' }
          }
        >
          {ratedCount}/{totalCount}
        </span>
        <svg
          className="w-4 h-4 text-text-faint flex-shrink-0 transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Items */}
      {isOpen && (
        <div className="border-t border-line divide-y divide-line">
          {category.items.map((item) => {
            const result = results.find((r) => r.itemId === item.id);

            return (
              <div key={item.id} className="px-4 py-3 bg-base">
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm text-text leading-relaxed">{item.description}</p>
                </div>
                <RatingButtons
                  value={result?.rating ?? null}
                  onChange={(rating) => onRatingChange(item.id, rating)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
