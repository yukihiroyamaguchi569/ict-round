import type { FacilityMember } from './facilitySettings';
import { INPUT_CLASS, OPTION_CLASS } from './optionStyles';

interface Props {
  members: FacilityMember[];
  /** Names of the checked members. */
  selected: ReadonlySet<string>;
  onToggle: (name: string) => void;
}

/** Members grouped by role, roles in order of first appearance. */
function byRole(members: FacilityMember[]): [string, FacilityMember[]][] {
  const groups = new Map<string, FacilityMember[]>();
  for (const member of members) {
    const list = groups.get(member.role);
    if (list) list.push(member);
    else groups.set(member.role, [member]);
  }
  return [...groups];
}

/** A checkbox per member, grouped by role. */
export default function MemberChecklist({ members, selected, onToggle }: Props) {
  return (
    <div className="space-y-4">
      {byRole(members).map(([role, list]) => (
        <div key={role} role="group" aria-label={role}>
          <p className="text-xs font-bold text-text-muted mb-1.5">{role}</p>
          <div className="grid grid-cols-2 gap-2">
            {list.map((member) => (
              <label key={member.name} className={OPTION_CLASS}>
                <input
                  type="checkbox"
                  checked={selected.has(member.name)}
                  onChange={() => onToggle(member.name)}
                  className={INPUT_CLASS}
                />
                <span className="text-sm text-text break-words">{member.name}</span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
