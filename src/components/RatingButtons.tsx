import type { Rating } from '../types';

const RATINGS: Rating[] = ['A', 'B', 'C'];

const RATING_COLORS: Record<NonNullable<Rating>, { bg: string; border: string; text: string }> = {
  A: { bg: '#059669', border: '#059669', text: '#fff' },
  B: { bg: '#D4A017', border: '#D4A017', text: '#fff' },
  C: { bg: '#DC2626', border: '#DC2626', text: '#fff' },
};

interface Props {
  value: Rating;
  onChange: (rating: Rating) => void;
}

export default function RatingButtons({ value, onChange }: Props) {
  return (
    <div className="flex gap-1.5 mt-2">
      {RATINGS.map((r) => {
        const isSelected = value === r;
        const colors = RATING_COLORS[r!];
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(isSelected ? null : r)}
            className="flex-1 h-10 rounded-t font-extrabold text-sm transition-all duration-150 active:scale-95"
            style={
              isSelected
                ? {
                    backgroundColor: colors.bg,
                    border: `2px solid ${colors.border}`,
                    color: colors.text,
                    boxShadow: `0 2px 8px ${colors.bg}60`,
                  }
                : {
                    backgroundColor: 'transparent',
                    border: `2px solid ${colors.border}40`,
                    color: colors.bg,
                  }
            }
          >
            {r}
          </button>
        );
      })}
    </div>
  );
}
