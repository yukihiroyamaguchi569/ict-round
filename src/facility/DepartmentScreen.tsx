import { useEffect, useRef } from 'react';
import { applicableItems, departmentProgress, markOf, type FacilityRound, type Mark } from './facilityRound';
import MarkButtons from './MarkButtons';

interface Props {
  round: FacilityRound;
  department: string;
  onMark: (itemId: string, mark: Mark) => void;
  /** Opens another department of the round. */
  onOpen: (department: string) => void;
}

/** One department: its applicable items with ○ / ×, and the way to the previous and next departments. */
export default function DepartmentScreen({ round, department, onMark, onOpen }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const items = applicableItems(round, department);
  const progress = departmentProgress(round, department);
  const index = round.departments.findIndex((d) => d.name === department);
  const previous = round.departments[index - 1]?.name;
  const next = index >= 0 ? round.departments[index + 1]?.name : undefined;

  // Moving to another department starts from its name, at the top of the page.
  useEffect(() => {
    heading.current?.focus();
  }, [department]);

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-extrabold text-text break-words focus:outline-none">
          {department}
        </h2>
        <p className="text-sm text-text-muted mt-1">
          記入済み {progress.marked} / {progress.total}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="card p-5 text-sm text-text-muted">この部署に当てはまる項目はありません。</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="card p-5">
              <p className="text-base text-text leading-relaxed break-words">{item.text}</p>
              <MarkButtons
                itemText={item.text}
                value={markOf(round, department, item.id)}
                onPress={(mark) => onMark(item.id, mark)}
              />
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="前後の部署" className="grid grid-cols-2 gap-3">
        {previous && <StepButton label="前の部署" name={previous} onClick={() => onOpen(previous)} />}
        {next && <StepButton label="次の部署" name={next} onClick={() => onOpen(next)} alignEnd />}
      </nav>
    </div>
  );
}

function StepButton({ label, name, onClick, alignEnd = false }: { label: string; name: string; onClick: () => void; alignEnd?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${name}`}
      className={`card px-4 py-4 hover:ring-2 hover:ring-primary transition ${alignEnd ? 'col-start-2 text-right' : 'text-left'}`}
    >
      <span className="block text-xs text-text-muted">{alignEnd ? `${label} →` : `← ${label}`}</span>
      <span className="block text-base font-bold text-text break-words">{name}</span>
    </button>
  );
}
