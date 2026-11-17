import { useState, type ReactNode } from 'react';
import type { FacilityMember, FacilitySettings } from './facilitySettings';
import type { StartResult, StartRoundInput } from './useFacilityRounds';
import { fromDateTimeLocal, toDateTimeLocal } from './dateTimeLocal';
import ScreenHeader from './ScreenHeader';

interface Props {
  settings: FacilitySettings;
  /** Initial value of the date and time. */
  now: Date;
  /** Message of a failed save, shown above the start button. */
  error: string | null;
  onStart: (input: Omit<StartRoundInput, 'settings'>) => Promise<StartResult>;
  onBack: () => void;
}

function toggle(set: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** Start screen: date and time, one theme, the groups picked today, and the members taking part. */
export default function RoundStartScreen({ settings, now, error, onStart, onBack }: Props) {
  const [dateTime, setDateTime] = useState(() => toDateTimeLocal(now));
  const [themeName, setThemeName] = useState<string | null>(null);
  const [groups, setGroups] = useState<Set<string>>(() => new Set());
  const [members, setMembers] = useState<Set<string>>(() => new Set());
  const [noDepartments, setNoDepartments] = useState(false);
  const [busy, setBusy] = useState(false);

  const startedAt = fromDateTimeLocal(dateTime);
  const canStart = themeName !== null && startedAt !== null && !busy;

  const handleStart = async () => {
    if (themeName === null || startedAt === null) return;
    setBusy(true);
    setNoDepartments(false);
    const result = await onStart({
      themeName,
      selectedGroups: [...groups],
      members: settings.members.filter((m) => members.has(m.name)),
      startedAt,
    });
    // On success the screen is left, so only the other outcomes come back here.
    setBusy(false);
    if (result === 'no-departments') setNoDepartments(true);
  };

  return (
    <div className="min-h-screen bg-base">
      {/* No way back while saving: the save would finish on another screen and could be started twice. */}
      <ScreenHeader subtitle="ラウンドを始める" onBack={onBack} backDisabled={busy} />

      <div className="animate-page px-4 py-5 pb-16 max-w-3xl mx-auto space-y-5">
        <FormCard title="日時">
          <input
            type="datetime-local"
            aria-label="日時"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className="w-full px-4 py-3 text-base rounded-t border-2 border-line bg-surface text-text focus:border-primary focus:outline-none"
          />
          {startedAt === null && <p className="text-xs text-danger mt-2">日時を入れてください。</p>}
        </FormCard>

        <ThemeField settings={settings} value={themeName} onChange={setThemeName} />
        <GroupField settings={settings} selected={groups} onToggle={(name) => setGroups((s) => toggle(s, name))} />
        <MemberField members={settings.members} selected={members} onToggle={(name) => setMembers((s) => toggle(s, name))} />

        {noDepartments && <Alert>回る部署がありません。「今日回るグループ」を 1 つ以上選んでください。</Alert>}
        {error && <Alert>{error}</Alert>}

        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={!canStart}
          className="btn-primary w-full py-4 text-base font-bold"
        >
          {busy ? '保存中...' : '始める'}
        </button>
        {themeName === null && <p className="text-xs text-text-muted text-center">テーマを選ぶと始められます。</p>}
      </div>
    </div>
  );
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="card p-4 border border-danger text-sm font-bold text-danger">
      {children}
    </p>
  );
}

function FormCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="card p-5">
      <legend className="sr-only">{title}</legend>
      <p aria-hidden="true" className="text-sm font-extrabold text-text mb-3">
        {title}
      </p>
      {children}
    </fieldset>
  );
}

const OPTION_CLASS =
  'flex items-start gap-3 px-3 py-3 rounded-t border-2 border-line has-[:checked]:border-primary has-[:checked]:bg-primary-light cursor-pointer';
const INPUT_CLASS = 'mt-0.5 w-5 h-5 accent-[var(--t-primary)] shrink-0';

function ThemeField({
  settings,
  value,
  onChange,
}: {
  settings: FacilitySettings;
  value: string | null;
  onChange: (name: string) => void;
}) {
  return (
    <FormCard title="テーマ">
      <div className="space-y-2">
        {settings.themes.map((theme) => (
          <label key={theme.name} className={OPTION_CLASS}>
            <input
              type="radio"
              name="theme"
              checked={value === theme.name}
              onChange={() => onChange(theme.name)}
              className={INPUT_CLASS}
            />
            <span className="text-sm text-text break-words">
              {theme.name}
              <span className="ml-2 text-xs text-text-muted">{theme.items.length} 項目</span>
            </span>
          </label>
        ))}
      </div>
    </FormCard>
  );
}

function departmentsOf(settings: FacilitySettings, group: string): string {
  return settings.departments
    .filter((d) => d.group === group)
    .map((d) => d.name)
    .join('、');
}

function GroupField({
  settings,
  selected,
  onToggle,
}: {
  settings: FacilitySettings;
  selected: ReadonlySet<string>;
  onToggle: (name: string) => void;
}) {
  const always = settings.groups.filter((g) => g.visit === 'always');
  const pickable = settings.groups.filter((g) => g.visit === 'select');
  return (
    <FormCard title="今日回るグループ">
      {pickable.length > 0 ? (
        <div className="space-y-2">
          {pickable.map((group) => (
            <label key={group.name} className={OPTION_CLASS}>
              <input
                type="checkbox"
                checked={selected.has(group.name)}
                onChange={() => onToggle(group.name)}
                className={INPUT_CLASS}
              />
              <span className="text-sm text-text break-words">
                {group.name}
                <span className="block text-xs text-text-muted mt-0.5">{departmentsOf(settings, group.name)}</span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted">選んで回るグループはありません。</p>
      )}
      {always.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold text-text">毎回回る部署</p>
          <ul className="mt-1 space-y-1">
            {always.map((group) => (
              <li key={group.name} className="text-xs text-text-muted break-words">
                {group.name}: {departmentsOf(settings, group.name)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </FormCard>
  );
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

function MemberField({
  members,
  selected,
  onToggle,
}: {
  members: FacilityMember[];
  selected: ReadonlySet<string>;
  onToggle: (name: string) => void;
}) {
  return (
    <FormCard title="参加者">
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
    </FormCard>
  );
}
