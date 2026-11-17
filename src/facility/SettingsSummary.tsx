import type { ReactNode } from 'react';
import {
  VISIT_LABELS,
  type FacilityGroup,
  type FacilityDepartment,
  type FacilityMember,
  type FacilitySettings,
  type FacilityTheme,
  type ThemeItem,
} from './facilitySettings';

/** Read-only view of the saved settings: groups with their departments, themes with items, members by role. */
export default function SettingsSummary({ settings }: { settings: FacilitySettings }) {
  return (
    <div className="space-y-5">
      <p className="text-xs text-text-muted leading-relaxed">
        この端末に保存している施設設定です。ファイルを読み込み直すと、この設定は新しいファイルの内容に置き換わります。
      </p>
      <GroupSection groups={settings.groups} departments={settings.departments} />
      <ThemeSection themes={settings.themes} />
      <MemberSection members={settings.members} />
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="card p-5">
      <h2 className="text-sm font-extrabold text-text mb-3">{title}</h2>
      {children}
    </section>
  );
}

function GroupSection({ groups, departments }: { groups: FacilityGroup[]; departments: FacilityDepartment[] }) {
  return (
    <SectionCard title={`部署グループと部署（${groups.length} グループ・${departments.length} 部署）`}>
      <ul className="space-y-3">
        {groups.map((group) => (
          <li key={group.name} className="border-t border-line pt-3 first:border-t-0 first:pt-0">
            <p className="text-sm font-bold text-text break-words">
              {group.name}
              <span className="ml-2 text-[11px] font-bold text-text-muted">回り方: {VISIT_LABELS[group.visit]}</span>
            </p>
            <p className="text-xs text-text-muted mt-1 break-words">
              {departments.filter((d) => d.group === group.name).map((d) => d.name).join('、')}
            </p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

/** "全部署" when no target group is set; the excluded departments follow in brackets. */
function targetText(item: ThemeItem): string {
  const target = item.targetGroups.length === 0 ? '全部署' : item.targetGroups.join('、');
  if (item.excludedDepartments.length === 0) return target;
  return `${target}（${item.excludedDepartments.join('、')}を除く）`;
}

function ThemeSection({ themes }: { themes: FacilityTheme[] }) {
  const itemCount = themes.reduce((sum, theme) => sum + theme.items.length, 0);
  return (
    <SectionCard title={`チェック項目（${themes.length} テーマ・${itemCount} 項目）`}>
      <div className="space-y-4">
        {themes.map((theme) => (
          <div key={theme.name}>
            <h3 className="text-xs font-extrabold text-primary mb-1.5 break-words">{theme.name}</h3>
            <ul className="space-y-2">
              {theme.items.map((item) => (
                <li key={item.id} className="text-xs leading-relaxed">
                  <p className="text-text break-words">{item.text}</p>
                  <p className="text-text-muted break-words">対象: {targetText(item)}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

/** Members grouped by role, roles in order of first appearance. */
function groupByRole(members: FacilityMember[]): [string, string[]][] {
  const byRole = new Map<string, string[]>();
  for (const { name, role } of members) {
    const names = byRole.get(role);
    if (names) names.push(name);
    else byRole.set(role, [name]);
  }
  return [...byRole];
}

function MemberSection({ members }: { members: FacilityMember[] }) {
  return (
    <SectionCard title={`参加者（${members.length} 名）`}>
      <dl className="space-y-2 text-xs">
        {groupByRole(members).map(([role, names]) => (
          <div key={role} className="flex flex-wrap gap-x-3">
            <dt className="font-bold text-text">{role}</dt>
            <dd className="text-text-muted break-words">{names.join('、')}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}
