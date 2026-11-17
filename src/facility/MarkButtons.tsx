import type { Mark } from './facilityRound';

// Colors follow RatingButtons: ○ like A (green), × like C (red).
const MARKS: { value: Mark; label: string; color: string }[] = [
  { value: 'ok', label: '○', color: '#059669' },
  { value: 'ng', label: '×', color: '#DC2626' },
];

interface Props {
  /** Item text; names the button group for screen readers. */
  itemText: string;
  value: Mark | undefined;
  /** Called with the pressed mark; the caller clears it when it is pressed again. */
  onPress: (mark: Mark) => void;
}

/** ○ / × buttons of one cell, large enough to press with one hand while walking. */
export default function MarkButtons({ itemText, value, onPress }: Props) {
  return (
    <div role="group" aria-label={itemText} className="flex items-center gap-2 mt-3">
      {MARKS.map(({ value: mark, label, color }) => {
        const pressed = value === mark;
        return (
          <button
            key={mark}
            type="button"
            aria-pressed={pressed}
            onClick={() => onPress(mark)}
            className="flex-1 h-14 rounded-t text-2xl font-extrabold transition-all duration-150 active:scale-95"
            style={
              pressed
                ? { backgroundColor: color, border: `2px solid ${color}`, color: '#fff', boxShadow: `0 2px 8px ${color}60` }
                : { backgroundColor: 'transparent', border: `2px solid ${color}40`, color }
            }
          >
            {label}
          </button>
        );
      })}
      {/* The slot keeps its width so the buttons do not move when a mark is set. */}
      <span className="w-16 shrink-0 text-center text-xs text-text-muted opacity-70">{value === undefined && '確認なし'}</span>
    </div>
  );
}
