import { departmentProgress, departmentsByGroup, type FacilityRound } from './facilityRound';

interface Props {
  round: FacilityRound;
  onOpen: (department: string) => void;
}

/** Departments of the round by group, each with its progress; pressing one opens it. */
export default function DepartmentList({ round, onOpen }: Props) {
  return (
    <div className="space-y-5">
      {departmentsByGroup(round).map(({ group, departments }) => (
        <section key={group} aria-label={group} className="card p-5">
          <h2 className="text-sm font-extrabold text-text mb-3">{group}</h2>
          <ul className="space-y-2">
            {departments.map((department) => {
              const progress = departmentProgress(round, department.name);
              const done = progress.total > 0 && progress.marked === progress.total;
              return (
                <li key={department.name}>
                  <button
                    type="button"
                    onClick={() => onOpen(department.name)}
                    className="w-full flex items-center gap-3 px-4 py-4 rounded-t border-2 border-line text-left hover:border-primary transition-colors"
                  >
                    <span className="flex-1 min-w-0 text-base font-bold text-text break-words">{department.name}</span>
                    <span className={`text-sm ${done ? 'font-bold text-primary' : 'text-text-muted'}`}>
                      記入済み {progress.marked} / {progress.total}
                    </span>
                    <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
