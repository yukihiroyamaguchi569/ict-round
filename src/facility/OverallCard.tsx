import type { FacilityRound } from './facilityRound';

/** Entry to the overall screen, above the department list: whether the overall comment is written, and the member count. */
export default function OverallCard({ round, onOpen }: { round: FacilityRound; onOpen: () => void }) {
  const written = round.overallComment.trim() !== '';
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="全体（総評と参加者）"
      className="card w-full flex items-center gap-3 p-5 text-left hover:ring-2 hover:ring-primary transition"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-base font-extrabold text-text">全体</span>
        <span className="block text-sm text-text-muted mt-1">
          総評 {written ? '記入済み' : '未記入'}・参加者 {round.members.length} 人
        </span>
      </span>
      <svg className="w-5 h-5 text-text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
