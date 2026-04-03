import type { Rating, ChecklistItemResult } from '../types';
import { CHECKLIST_CATEGORIES, TOTAL_ITEMS } from '../checklistData';
import CategoryAccordion from './CategoryAccordion';

interface Props {
  checklistResults: ChecklistItemResult[];
  onRatingChange: (itemId: string, rating: Rating) => void;
}

export default function ChecklistTab({ checklistResults, onRatingChange }: Props) {
  const ratedCount = checklistResults.filter((r) => r.rating !== null).length;
  const progress = Math.round((ratedCount / TOTAL_ITEMS) * 100);

  return (
    <div className="px-4 py-4 space-y-3 pb-6">
      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-text-muted">入力進捗</span>
          <span className="text-xs font-bold text-primary">{ratedCount} / {TOTAL_ITEMS}</span>
        </div>
        <div className="h-2 bg-base-deep rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              backgroundColor: progress === 100 ? '#059669' : 'var(--t-primary)',
            }}
          />
        </div>
      </div>

      {/* Category accordions */}
      {CHECKLIST_CATEGORIES.map((cat, idx) => (
        <CategoryAccordion
          key={cat.category}
          category={cat}
          results={checklistResults}
          onRatingChange={onRatingChange}
          defaultOpen={idx === 0}
        />
      ))}
    </div>
  );
}
