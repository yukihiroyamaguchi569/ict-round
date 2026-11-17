import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FacilityApp from '../../facility/FacilityApp';
import RoundStartScreen from '../../facility/RoundStartScreen';
import HomeScreen from '../../facility/HomeScreen';
import type { FacilitySettings } from '../../facility/facilitySettings';
import { saveFacilitySettings } from '../../facility/facilityStorage';
import { openFacilityDb } from '../../facility/roundDb';
import type { FacilityRound } from '../../facility/facilityRound';

let factory: IDBFactory;

beforeEach(() => {
  vi.stubEnv('TZ', 'Asia/Tokyo');
  factory = new IDBFactory();
  vi.stubGlobal('indexedDB', factory);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function settings(): FacilitySettings {
  return {
    version: 1,
    groups: [
      { name: '病棟', visit: 'always' },
      { name: '外来', visit: 'select' },
      { name: '検査', visit: 'select' },
    ],
    departments: [
      { name: '3東', group: '病棟' },
      { name: '内科外来', group: '外来' },
      { name: '透析室', group: '外来' },
      { name: '検査室', group: '検査' },
    ],
    themes: [
      {
        name: '手指衛生',
        items: [
          { id: 'a', text: '全部署の項目', targetGroups: [], excludedDepartments: [] },
          { id: 'b', text: '外来だけの項目', targetGroups: ['外来'], excludedDepartments: ['透析室'] },
        ],
      },
      { name: '環境整備', items: [{ id: 'c', text: '棚', targetGroups: [], excludedDepartments: [] }] },
    ],
    members: [
      { name: '看護 花子', role: '看護師' },
      { name: '医師 太郎', role: '医師' },
      { name: '看護 次郎', role: '看護師' },
    ],
  };
}

async function storedRounds(): Promise<FacilityRound[]> {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('open failed');
  const list = await open.value.listRounds();
  open.value.close();
  if (!list.ok) throw new Error('list failed');
  // Written by the app under test through createFacilityRound; read back only to inspect it.
  return list.value as FacilityRound[];
}

function startButton() {
  return screen.getByRole('button', { name: 'ラウンドを始める' });
}

async function renderHome() {
  render(<FacilityApp />);
  // The list shows once the database has been read.
  await screen.findByText(/まだラウンドはありません。|記入済み|保存できないため/);
  return userEvent.setup();
}

async function openStart() {
  const user = await renderHome();
  await user.click(startButton());
  return user;
}

function startSubmit() {
  return screen.getByRole('button', { name: '始める' });
}

describe('FacilityApp without the preview flag', () => {
  it('shows only the settings screen and never opens IndexedDB', async () => {
    vi.stubEnv('VITE_FACILITY_ROUND', undefined);
    vi.resetModules();
    const open = vi.spyOn(factory, 'open');
    const { default: ProductionApp } = await import('../../facility/FacilityApp');
    render(<ProductionApp />);
    expect(screen.getByText('全部署を回るラウンドの施設設定（開発中）')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ひな形をダウンロード' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ラウンドを始める' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ホームへ戻る' })).not.toBeInTheDocument();
    expect(open).not.toHaveBeenCalled();
  });

  it('is not themed: no data-theme on the document, as before the round screens', async () => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('icn-round-theme', 'warm');
    vi.stubEnv('VITE_FACILITY_ROUND', undefined);
    vi.resetModules();
    const { default: ProductionApp } = await import('../../facility/FacilityApp');
    render(<ProductionApp />);
    expect(screen.getByText('全部署を回るラウンドの施設設定（開発中）')).toBeInTheDocument();
    expect(document.documentElement).not.toHaveAttribute('data-theme');
  });
});

describe('FacilityApp with the preview flag', () => {
  it('is themed with the theme chosen in the main app, as the add-photo screen needs', async () => {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('icn-round-theme', 'warm');
    await renderHome();
    expect(document.documentElement).toHaveAttribute('data-theme', 'warm');
  });
});

describe('FacilityApp home', () => {
  it('cannot start without settings and leads to the settings screen and back', async () => {
    const user = await renderHome();
    expect(startButton()).toBeDisabled();
    expect(screen.getByText(/先に施設設定を読み込んでください/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^施設設定まだ読み込んでいません$/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '施設設定へ' }));
    expect(screen.getByText('全部署を回るラウンドの施設設定（開発中）')).toBeInTheDocument();
    expect(screen.getByText('まだ施設設定が保存されていません。')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    expect(startButton()).toBeDisabled();
  });

  it('reads the settings again when coming back from the settings screen', async () => {
    const user = await renderHome();
    await user.click(screen.getByRole('button', { name: '施設設定へ' }));
    // Stands in for a file read on the settings screen.
    saveFacilitySettings(settings());
    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    expect(startButton()).toBeEnabled();
    expect(screen.getByRole('button', { name: /2 テーマ・4 部署・参加者 3 名/ })).toBeInTheDocument();
  });

  it('shows that rounds cannot be saved when IndexedDB is missing, and does not start', async () => {
    saveFacilitySettings(settings());
    vi.stubGlobal('indexedDB', undefined);
    await renderHome();
    expect(screen.getByRole('alert')).toHaveTextContent('この端末のブラウザではラウンドを保存できないため、始められません。');
    expect(startButton()).toBeDisabled();
  });
});

describe('FacilityApp round start', () => {
  beforeEach(() => saveFacilitySettings(settings()));

  it('fills the date and time with now, in device-local time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T01:05:00Z'));
    await openStart();
    expect(screen.getByLabelText('日時')).toHaveValue('2026-11-18T10:05');
  });

  it('lists themes with item counts, pickable groups with their departments, the always departments and members by role', async () => {
    await openStart();
    expect(screen.getAllByRole('radio').map((r) => [r.closest('label')?.textContent, (r as HTMLInputElement).checked])).toEqual([
      ['手指衛生2 項目', false],
      ['環境整備1 項目', false],
    ]);
    expect(screen.getAllByRole('checkbox').slice(0, 2).map((c) => c.closest('label')?.textContent)).toEqual([
      '外来内科外来、透析室',
      '検査検査室',
    ]);
    expect(screen.queryByRole('checkbox', { name: /病棟/ })).not.toBeInTheDocument();
    expect(screen.getByText('病棟: 3東')).toBeInTheDocument();
    const nurses = screen.getByRole('group', { name: '看護師' });
    expect(within(nurses).getAllByRole('checkbox').map((c) => c.closest('label')?.textContent)).toEqual([
      '看護 花子',
      '看護 次郎',
    ]);
    expect(within(screen.getByRole('group', { name: '医師' })).getByRole('checkbox', { name: '医師 太郎' })).toBeInTheDocument();
  });

  it('cannot start until a theme is chosen or with an empty date', async () => {
    const user = await openStart();
    expect(startSubmit()).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /手指衛生/ }));
    expect(startSubmit()).toBeEnabled();
    fireEvent.change(screen.getByLabelText('日時'), { target: { value: '' } });
    expect(startSubmit()).toBeDisabled();
    expect(screen.getByText('日時を入れてください。')).toBeInTheDocument();
  });

  it('starts a round with the chosen inputs, goes home and lists it; it is still there after a remount', async () => {
    const user = await openStart();
    fireEvent.change(screen.getByLabelText('日時'), { target: { value: '2026-11-20T14:30' } });
    await user.click(screen.getByRole('radio', { name: /手指衛生/ }));
    await user.click(screen.getByRole('checkbox', { name: /外来/ }));
    await user.click(screen.getByRole('checkbox', { name: '看護 次郎' }));
    await user.click(startSubmit());

    const list = await screen.findByRole('region', { name: 'この端末のラウンド' });
    expect(list).toHaveTextContent('2026/11/20 14:30');
    expect(list).toHaveTextContent('手指衛生');
    // 3東: item a; 内科外来: a and b; 透析室: a (b excludes it).
    expect(list).toHaveTextContent('記入済み 0 / 4');

    const [saved] = await storedRounds();
    expect(saved.startedAt).toBe('2026-11-20T05:30:00.000Z');
    expect(saved.departments.map((d) => d.name)).toEqual(['3東', '内科外来', '透析室']);
    expect(saved.members).toEqual([{ name: '看護 次郎', role: '看護師' }]);

    // A fresh mount reads the round back from IndexedDB.
    render(<FacilityApp />);
    await waitFor(() => expect(screen.getAllByText('2026/11/20 14:30')).toHaveLength(2));
  });

  it('starts with no pickable group chosen when an always group exists', async () => {
    const user = await openStart();
    await user.click(screen.getByRole('radio', { name: /環境整備/ }));
    await user.click(startSubmit());
    expect(await screen.findByText('記入済み 0 / 1')).toBeInTheDocument();
  });

  it('says there is no department to visit and saves nothing when none would be visited', async () => {
    saveFacilitySettings({ ...settings(), groups: settings().groups.map((g) => ({ ...g, visit: 'select' as const })) });
    const user = await openStart();
    await user.click(screen.getByRole('radio', { name: /手指衛生/ }));
    await user.click(startSubmit());
    expect(await screen.findByRole('alert')).toHaveTextContent('回る部署がありません。');
    expect(startSubmit()).toBeEnabled();
    expect(await storedRounds()).toEqual([]);
  });

  it('shows a failed save on the start screen and stays there', async () => {
    const user = await openStart();
    await user.click(screen.getByRole('radio', { name: /手指衛生/ }));
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    await user.click(startSubmit());
    expect(await screen.findByRole('alert')).toHaveTextContent('保存容量の上限に達したため保存できませんでした');
    expect(startSubmit()).toBeEnabled();
    vi.restoreAllMocks();
    expect(await storedRounds()).toEqual([]);

    // The message does not follow the user home.
    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('cannot go back while the round is being saved, so it is never started twice', async () => {
    let finish: (result: 'failed') => void = () => {};
    const onStart = vi.fn(() => new Promise<'failed'>((resolve) => { finish = resolve; }));
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(<RoundStartScreen settings={settings()} now={new Date()} error={null} onStart={onStart} onBack={onBack} />);
    await user.click(screen.getByRole('radio', { name: /手指衛生/ }));
    await user.click(startSubmit());
    expect(screen.getByRole('button', { name: '保存中...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'ホームへ戻る' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    expect(onBack).not.toHaveBeenCalled();
    finish('failed');
    await waitFor(() => expect(screen.getByRole('button', { name: 'ホームへ戻る' })).toBeEnabled());
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('goes back home without starting', async () => {
    const user = await openStart();
    await user.click(screen.getByRole('radio', { name: /手指衛生/ }));
    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    expect(screen.getByText('まだラウンドはありません。')).toBeInTheDocument();
    expect(await storedRounds()).toEqual([]);
  });
});

describe('FacilityApp round delete', () => {
  beforeEach(() => saveFacilitySettings(settings()));

  async function startOne() {
    const user = await openStart();
    fireEvent.change(screen.getByLabelText('日時'), { target: { value: '2026-11-20T14:30' } });
    await user.click(screen.getByRole('radio', { name: /手指衛生/ }));
    await user.click(startSubmit());
    await screen.findByText('2026/11/20 14:30');
    return user;
  }

  it('asks on screen before deleting; cancel keeps the round', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const user = await startOne();
    const deleteButton = screen.getByRole('button', { name: '2026/11/20 14:30 手指衛生 を削除' });
    await user.click(deleteButton);
    const dialog = screen.getByRole('dialog', { name: 'このラウンドを削除しますか？' });
    expect(dialog).toHaveTextContent('2026/11/20 14:30・手指衛生');
    // Focus starts on the safe choice, and the screen behind is out of reach.
    const cancel = within(dialog).getByRole('button', { name: 'キャンセル' });
    expect(cancel).toHaveFocus();
    expect(deleteButton.closest('[inert]')).not.toBeNull();
    await user.click(cancel);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteButton.closest('[inert]')).toBeNull();
    await waitFor(() => expect(deleteButton).toHaveFocus());
    expect(screen.getByText('2026/11/20 14:30')).toBeInTheDocument();
    expect(await storedRounds()).toHaveLength(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('deletes the round after the confirmation', async () => {
    const user = await startOne();
    await user.click(screen.getByRole('button', { name: /を削除$/ }));
    await user.click(screen.getByRole('button', { name: '削除する' }));
    expect(await screen.findByText('まだラウンドはありません。')).toBeInTheDocument();
    expect(await storedRounds()).toEqual([]);
    // The deleted round's button is gone; focus lands on the list heading.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'この端末のラウンド' })).toHaveFocus());
  });

  it('keeps the dialog buttons disabled while deleting, so the delete is sent once', async () => {
    let finish: (deleted: boolean) => void = () => {};
    const onDelete = vi.fn(() => new Promise<boolean>((resolve) => { finish = resolve; }));
    const round: FacilityRound = {
      version: 1, id: 'r1', startedAt: '2026-11-20T05:30:00.000Z', themeName: '手指衛生', items: [],
      departments: [], members: [], marks: {}, departmentComments: {}, overallComment: '', photos: [],
    };
    const user = userEvent.setup();
    render(
      <HomeScreen settings={settings()} status="ready" rounds={[round]} error={null}
        onStart={vi.fn()} onOpenSettings={vi.fn()} onOpen={vi.fn()} onDelete={onDelete} />
    );
    await user.click(screen.getByRole('button', { name: /を削除$/ }));
    await user.click(screen.getByRole('button', { name: '削除する' }));
    expect(screen.getByRole('button', { name: '削除する' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '削除する' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith('r1');
    finish(true);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows a failed delete and keeps the round', async () => {
    const user = await startOne();
    vi.spyOn(FakeObjectStore.prototype, 'delete').mockImplementation(() => {
      throw new DOMException('failed', 'UnknownError');
    });
    await user.click(screen.getByRole('button', { name: /を削除$/ }));
    await user.click(screen.getByRole('button', { name: '削除する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('削除できませんでした。');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('2026/11/20 14:30')).toBeInTheDocument();
    // Focus goes back to the round's delete button, which is still there.
    await waitFor(() => expect(screen.getByRole('button', { name: /を削除$/ })).toHaveFocus());
  });
});
