import { useEffect, useRef } from 'react';
import { memberChoices, type FacilityRound } from './facilityRound';
import type { FacilityMember } from './facilitySettings';
import MemberChecklist from './MemberChecklist';
import { TEXTAREA_CLASS } from './optionStyles';

interface Props {
  round: FacilityRound;
  /** Members of the settings on this device; null when none are saved. */
  roster: FacilityMember[] | null;
  onOverallComment: (text: string) => void;
  onMembers: (members: FacilityMember[]) => void;
}

/** The whole round: the overall comment and the members taking part. */
export default function OverallScreen({ round, roster, onOverallComment, onMembers }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  const choices = memberChoices(roster, round.members);
  const selected = new Set(round.members.map((m) => m.name));

  useEffect(() => {
    heading.current?.focus();
  }, []);

  // Keeps the order of the choices, so the members read the same as on the start screen.
  const toggle = (name: string) => {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onMembers(choices.filter((m) => next.has(m.name)));
  };

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h2 ref={heading} tabIndex={-1} className="text-xl font-extrabold text-text focus:outline-none">
          全体
        </h2>
      </div>

      <label className="card p-5 block">
        <span className="block text-sm font-extrabold text-text mb-3">総評</span>
        <textarea
          value={round.overallComment}
          onChange={(e) => onOverallComment(e.target.value)}
          rows={8}
          className={TEXTAREA_CLASS}
        />
      </label>

      <fieldset className="card p-5">
        <legend className="sr-only">参加者</legend>
        <p aria-hidden="true" className="text-sm font-extrabold text-text mb-3">
          参加者
        </p>
        {choices.length > 0 ? (
          <MemberChecklist members={choices} selected={selected} onToggle={toggle} />
        ) : (
          <p className="text-xs text-text-muted">施設設定に参加者がいません。</p>
        )}
      </fieldset>
    </div>
  );
}
