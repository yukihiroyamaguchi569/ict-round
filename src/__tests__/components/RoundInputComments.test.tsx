import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoundInputScreen from '../../facility/RoundInputScreen';
import FacilityApp from '../../facility/FacilityApp';
import { openFacilityDb } from '../../facility/roundDb';
import { saveFacilitySettings } from '../../facility/facilityStorage';
import type { FacilityRound } from '../../facility/facilityRound';
import type { FacilityMember } from '../../facility/facilitySettings';

let factory: IDBFactory;

beforeEach(() => {
  vi.stubEnv('TZ', 'Asia/Tokyo');
  factory = new IDBFactory();
  vi.stubGlobal('indexedDB', factory);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ROSTER: FacilityMember[] = [
  { name: '医師 太郎', role: '医師' },
  { name: '看護 花子', role: '看護師' },
  { name: '看護 次郎', role: '看護師' },
];

function round(patch: Partial<FacilityRound> = {}): FacilityRound {
  return {
    version: 1,
    id: 'r1',
    startedAt: '2026-11-20T05:30:00.000Z',
    themeName: '環境整備',
    items: [{ id: 'a', text: '高頻度接触面が清拭されている', targetGroups: [], excludedDepartments: [] }],
    departments: [
      { name: '3東', group: '病棟' },
      { name: '透析室', group: '外来' },
    ],
    members: [{ name: '看護 花子', role: '看護師' }],
    marks: {},
    departmentComments: {},
    overallComment: '',
    photos: [],
    ...patch,
  };
}

async function seed(record: FacilityRound) {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('seed: open failed');
  await open.value.putRound(record);
  open.value.close();
}

async function stored(): Promise<FacilityRound> {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('open failed');
  const read = await open.value.getRound('r1');
  open.value.close();
  if (!read.ok) throw new Error('get failed');
  // Written by the code under test; read back only to inspect it.
  return read.value as FacilityRound;
}

async function renderInput({ record = round(), roster = ROSTER as FacilityMember[] | null, onBack = vi.fn() } = {}) {
  await seed(record);
  render(<RoundInputScreen roundId="r1" roster={roster} onBack={onBack} />);
  await screen.findByRole('region', { name: '病棟' });
  return userEvent.setup();
}

async function goHome(user: ReturnType<typeof userEvent.setup>, onBack: ReturnType<typeof vi.fn>) {
  await user.click(screen.getByRole('button', { name: '部署の一覧へ戻る' }));
  await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
  await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
}

describe('RoundInputScreen department comment', () => {
  it('keeps a comment per department and saves them on the way home', async () => {
    const onBack = vi.fn();
    const user = await renderInput({ onBack });
    await user.click(screen.getByRole('button', { name: /^3東/ }));
    await user.type(screen.getByLabelText('この部署のコメント'), '床が汚れている');

    await user.click(screen.getByRole('button', { name: '次の部署: 透析室' }));
    expect(screen.getByLabelText('この部署のコメント')).toHaveValue('');
    await user.type(screen.getByLabelText('この部署のコメント'), '問題なし');

    await user.click(screen.getByRole('button', { name: '前の部署: 3東' }));
    expect(screen.getByLabelText('この部署のコメント')).toHaveValue('床が汚れている');

    await goHome(user, onBack);
    expect((await stored()).departmentComments).toEqual({ '3東': '床が汚れている', 透析室: '問題なし' });
  });

  it('shows a stored comment, with line breaks', async () => {
    const user = await renderInput({ record: round({ departmentComments: { 透析室: '1 行目\n2 行目' } }) });
    await user.click(screen.getByRole('button', { name: /^透析室/ }));
    expect(screen.getByLabelText('この部署のコメント')).toHaveValue('1 行目\n2 行目');
  });
});

describe('RoundInputScreen overall', () => {
  it('opens from the card above the departments, which shows whether the comment is written and the member count', async () => {
    const onBack = vi.fn();
    const user = await renderInput({ onBack });
    const card = screen.getByRole('button', { name: '全体（総評と参加者）' });
    expect(card).toHaveTextContent('総評 未記入・参加者 1 人');
    expect(card.compareDocumentPosition(screen.getByRole('region', { name: '病棟' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(card);
    expect(screen.getByRole('heading', { name: '全体' })).toHaveFocus();
    await user.type(screen.getByLabelText('総評'), '全体に良好');
    await user.click(screen.getByRole('button', { name: '部署の一覧へ戻る' }));
    expect(screen.getByRole('button', { name: '全体（総評と参加者）' })).toHaveTextContent('総評 記入済み・参加者 1 人');
    expect(screen.getByRole('heading', { name: '部署の一覧' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect((await stored()).overallComment).toBe('全体に良好');
  });

  it('counts a comment of only spaces as not written', async () => {
    await renderInput({ record: round({ overallComment: ' \n ' }) });
    expect(screen.getByRole('button', { name: '全体（総評と参加者）' })).toHaveTextContent('総評 未記入');
  });

  it('chooses members again from the roster, by role, and saves them in roster order', async () => {
    const user = await renderInput();
    await user.click(screen.getByRole('button', { name: '全体（総評と参加者）' }));
    const nurses = screen.getByRole('group', { name: '看護師' });
    expect(within(nurses).getByRole('checkbox', { name: '看護 花子' })).toBeChecked();
    expect(within(nurses).getByRole('checkbox', { name: '看護 次郎' })).not.toBeChecked();

    await user.click(within(nurses).getByRole('checkbox', { name: '看護 次郎' }));
    await user.click(within(screen.getByRole('group', { name: '医師' })).getByRole('checkbox', { name: '医師 太郎' }));
    await waitFor(async () => expect((await stored()).members).toEqual(ROSTER));

    await user.click(within(nurses).getByRole('checkbox', { name: '看護 花子' }));
    await waitFor(async () => expect((await stored()).members).toEqual([ROSTER[0], ROSTER[2]]));
  });

  it('lists a member missing from the roster as chosen, and drops them once unchecked', async () => {
    const gone = { name: '薬剤 一郎', role: '薬剤師' };
    const user = await renderInput({ record: round({ members: [gone, ROSTER[1]] }) });
    await user.click(screen.getByRole('button', { name: '全体（総評と参加者）' }));
    const pharmacist = within(screen.getByRole('group', { name: '薬剤師' })).getByRole('checkbox', { name: '薬剤 一郎' });
    expect(pharmacist).toBeChecked();

    await user.click(pharmacist);
    await waitFor(async () => expect((await stored()).members).toEqual([ROSTER[1]]));

    // Still offered while the screen is open, so it can be chosen again.
    const again = within(screen.getByRole('group', { name: '薬剤師' })).getByRole('checkbox', { name: '薬剤 一郎' });
    expect(again).not.toBeChecked();
    await user.click(again);
    await waitFor(async () => expect((await stored()).members).toEqual([ROSTER[1], gone]));
  });

  it('lists only the round members when no settings are saved', async () => {
    const user = await renderInput({ roster: null });
    await user.click(screen.getByRole('button', { name: '全体（総評と参加者）' }));
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: '看護 花子' })).toBeChecked();
  });

  it('says so when there is no member to choose from', async () => {
    const user = await renderInput({ record: round({ members: [] }), roster: null });
    await user.click(screen.getByRole('button', { name: '全体（総評と参加者）' }));
    expect(screen.getByText('施設設定に参加者がいません。')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('FacilityApp overall members', () => {
  it('offers the roster of the settings saved on this device', async () => {
    saveFacilitySettings({ version: 1, groups: [], departments: [], themes: [], members: ROSTER });
    await seed(round());
    render(<FacilityApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '2026/11/20 14:30 環境整備 を開く' }));
    await user.click(await screen.findByRole('button', { name: '全体（総評と参加者）' }));
    expect(screen.getByRole('checkbox', { name: '医師 太郎' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: '看護 花子' })).toBeChecked();
  });
});
