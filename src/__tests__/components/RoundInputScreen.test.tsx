import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoundInputScreen from '../../facility/RoundInputScreen';
import { AUTOSAVE_ERROR_MESSAGE } from '../../facility/useFacilityRound';
import FacilityApp from '../../facility/FacilityApp';
import { openFacilityDb } from '../../facility/roundDb';
import type { FacilityRound } from '../../facility/facilityRound';

let factory: IDBFactory;

beforeEach(() => {
  vi.stubEnv('TZ', 'Asia/Tokyo');
  factory = new IDBFactory();
  vi.stubGlobal('indexedDB', factory);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function round(): FacilityRound {
  return {
    version: 1,
    id: 'r1',
    startedAt: '2026-11-20T05:30:00.000Z',
    themeName: '環境整備',
    items: [
      { id: 'a', text: '高頻度接触面が清拭されている', targetGroups: [], excludedDepartments: [] },
      { id: 'b', text: '汚物処理室に汚れがない', targetGroups: ['病棟', '外来'], excludedDepartments: ['透析室'] },
    ],
    departments: [
      { name: '3東', group: '病棟' },
      { name: '内視鏡室', group: '外来' },
      { name: '透析室', group: '外来' },
    ],
    members: [],
    marks: { '3東': { a: 'ok' } },
    departmentComments: {},
    overallComment: '',
    photos: [],
  };
}

async function seed<T extends { id: string }>(record: T) {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('seed: open failed');
  await open.value.putRound(record);
  open.value.close();
}

async function storedMarks(): Promise<unknown> {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('open failed');
  const read = await open.value.getRound('r1');
  open.value.close();
  if (!read.ok) throw new Error('get failed');
  // Written by the code under test; read back only to inspect it.
  return (read.value as FacilityRound).marks;
}

async function renderInput(onBack = vi.fn()) {
  await seed(round());
  render(<RoundInputScreen roundId="r1" onBack={onBack} />);
  await screen.findByRole('region', { name: '病棟' });
  return userEvent.setup();
}

function item(text: string) {
  return screen.getByRole('group', { name: text });
}

describe('RoundInputScreen department list', () => {
  it('lists the departments by group with their progress, and the round progress in the header', async () => {
    await renderInput();
    expect(screen.getByText('2026/11/20 14:30 環境整備（記入済み 1 / 5）')).toBeInTheDocument();
    const ward = screen.getByRole('region', { name: '病棟' });
    expect(within(ward).getByRole('button', { name: /3東/ })).toHaveTextContent('記入済み 1 / 2');
    const outpatient = screen.getByRole('region', { name: '外来' });
    expect(within(outpatient).getAllByRole('button').map((b) => b.textContent)).toEqual([
      '内視鏡室記入済み 0 / 2',
      '透析室記入済み 0 / 1',
    ]);
  });

  it('goes home with the back button', async () => {
    const onBack = vi.fn();
    const user = await renderInput(onBack);
    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('RoundInputScreen department', () => {
  it('shows only the applicable items of the department', async () => {
    const user = await renderInput();
    await user.click(screen.getByRole('button', { name: /透析室/ }));
    expect(screen.getByRole('heading', { name: '透析室' })).toBeInTheDocument();
    expect(item('高頻度接触面が清拭されている')).toBeInTheDocument();
    expect(screen.queryByText('汚物処理室に汚れがない')).not.toBeInTheDocument();
    expect(screen.getAllByRole('group')).toHaveLength(1);
  });

  it('shows the stored marks as pressed, and "確認なし" for an item without one', async () => {
    const user = await renderInput();
    await user.click(screen.getByRole('button', { name: /3東/ }));
    const marked = item('高頻度接触面が清拭されている');
    expect(within(marked).getByRole('button', { name: '○' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(marked).getByRole('button', { name: '×' })).toHaveAttribute('aria-pressed', 'false');
    expect(marked).not.toHaveTextContent('確認なし');
    expect(item('汚物処理室に汚れがない')).toHaveTextContent('確認なし');
  });

  it('sets ○, clears it with ○ again, and changes it to ×, saving each time', async () => {
    const user = await renderInput();
    await user.click(screen.getByRole('button', { name: /内視鏡室/ }));
    const cell = item('汚物処理室に汚れがない');
    const ok = within(cell).getByRole('button', { name: '○' });
    const ng = within(cell).getByRole('button', { name: '×' });

    await user.click(ok);
    expect(ok).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('記入済み 1 / 2')).toBeInTheDocument();
    await waitFor(async () => expect(await storedMarks()).toEqual({ '3東': { a: 'ok' }, 内視鏡室: { b: 'ok' } }));

    await user.click(ok);
    expect(ok).toHaveAttribute('aria-pressed', 'false');
    expect(cell).toHaveTextContent('確認なし');
    expect(screen.getByText('記入済み 0 / 2')).toBeInTheDocument();
    await waitFor(async () => expect(await storedMarks()).toEqual({ '3東': { a: 'ok' }, 内視鏡室: {} }));

    await user.click(ok);
    await user.click(ng);
    expect(ok).toHaveAttribute('aria-pressed', 'false');
    expect(ng).toHaveAttribute('aria-pressed', 'true');
    await waitFor(async () => expect(await storedMarks()).toEqual({ '3東': { a: 'ok' }, 内視鏡室: { b: 'ng' } }));
  });

  it('shows a failed save as an alert with the mark kept, and clears it once the next change is saved', async () => {
    const user = await renderInput();
    await user.click(screen.getByRole('button', { name: /内視鏡室/ }));
    const put = vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const first = within(item('高頻度接触面が清拭されている')).getByRole('button', { name: '×' });
    await user.click(first);
    expect(await screen.findByRole('alert')).toHaveTextContent(AUTOSAVE_ERROR_MESSAGE);
    expect(first).toHaveAttribute('aria-pressed', 'true');

    put.mockRestore();
    await user.click(within(item('汚物処理室に汚れがない')).getByRole('button', { name: '○' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(await storedMarks()).toEqual({ '3東': { a: 'ok' }, 内視鏡室: { a: 'ng', b: 'ok' } });
  });

  it('moves to the previous and next departments in list order, with no step past either end', async () => {
    const user = await renderInput();
    await user.click(screen.getByRole('button', { name: /3東/ }));
    expect(screen.queryByRole('button', { name: /^前の部署/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '次の部署: 内視鏡室' }));
    expect(screen.getByRole('heading', { name: '内視鏡室' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: '次の部署: 透析室' }));
    expect(screen.getByRole('heading', { name: '透析室' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^次の部署/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '前の部署: 内視鏡室' }));
    expect(screen.getByRole('heading', { name: '内視鏡室' })).toBeInTheDocument();
  });

  it('goes back to the list with the progress updated', async () => {
    const user = await renderInput();
    await user.click(screen.getByRole('button', { name: /透析室/ }));
    await user.click(within(item('高頻度接触面が清拭されている')).getByRole('button', { name: '×' }));
    await user.click(screen.getByRole('button', { name: '部署の一覧へ戻る' }));
    expect(screen.getByRole('button', { name: /透析室/ })).toHaveTextContent('記入済み 1 / 1');
    expect(screen.getByText('2026/11/20 14:30 環境整備（記入済み 2 / 5）')).toBeInTheDocument();
  });

  it('says so when the department has no applicable item', async () => {
    const noItems = { ...round(), items: [round().items[1]] };
    await seed(noItems);
    render(<RoundInputScreen roundId="r1" onBack={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /透析室/ }));
    expect(screen.getByText('この部署に当てはまる項目はありません。')).toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });
});

describe('RoundInputScreen leaving with a failed save', () => {
  async function failOnce() {
    return vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new Error('boom');
    });
  }

  async function markWithFailedSave(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: /透析室/ }));
    await user.click(within(item('高頻度接触面が清拭されている')).getByRole('button', { name: '×' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(AUTOSAVE_ERROR_MESSAGE);
    await user.click(screen.getByRole('button', { name: '部署の一覧へ戻る' }));
  }

  it('saves again on the way home and leaves once that save works', async () => {
    const onBack = vi.fn();
    const user = await renderInput(onBack);
    const put = await failOnce();
    await markWithFailedSave(user);
    put.mockRestore();
    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await storedMarks()).toEqual({ '3東': { a: 'ok' }, 透析室: { a: 'ng' } });
  });

  it('asks before leaving when the save fails again; staying keeps the input', async () => {
    const onBack = vi.fn();
    const user = await renderInput(onBack);
    const put = await failOnce();
    await markWithFailedSave(user);
    put.mockImplementation(() => {
      throw new Error('still broken');
    });
    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('保存できていない入力があります。戻るとこの入力は失われます。');
    expect(within(dialog).getByRole('button', { name: 'この画面に残る' })).toHaveFocus();
    expect(onBack).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'この画面に残る' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /透析室/ })).toHaveTextContent('記入済み 1 / 1');
    await waitFor(() => expect(screen.getByRole('heading', { name: '部署の一覧' })).toHaveFocus());
  });

  it('leaves without saving when chosen in the dialog', async () => {
    const onBack = vi.fn();
    const user = await renderInput(onBack);
    const put = await failOnce();
    await markWithFailedSave(user);
    put.mockImplementation(() => {
      throw new Error('still broken');
    });
    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: '保存せずに戻る' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('leaves at once when no save has failed', async () => {
    const onBack = vi.fn();
    const user = await renderInput(onBack);
    await user.click(screen.getByRole('button', { name: /透析室/ }));
    await user.click(within(item('高頻度接触面が清拭されている')).getByRole('button', { name: '○' }));
    await user.click(screen.getByRole('button', { name: '部署の一覧へ戻る' }));
    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('RoundInputScreen focus', () => {
  it('moves focus to the department list heading on entering, and back to it from a department', async () => {
    const user = await renderInput();
    await waitFor(() => expect(screen.getByRole('heading', { name: '部署の一覧' })).toHaveFocus());
    await user.click(screen.getByRole('button', { name: /3東/ }));
    await user.click(screen.getByRole('button', { name: '部署の一覧へ戻る' }));
    expect(screen.getByRole('heading', { name: '部署の一覧' })).toHaveFocus();
  });
});

describe('RoundInputScreen unreadable round', () => {
  it('says the round cannot be read and goes home', async () => {
    await seed({ id: 'r1', version: 1 });
    const onBack = vi.fn();
    render(<RoundInputScreen roundId="r1" onBack={onBack} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('このラウンドを読み込めませんでした。');
    await userEvent.setup().click(within(screen.getByRole('alert')).getByRole('button', { name: 'ホームへ戻る' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('says so for a round that is not stored', async () => {
    render(<RoundInputScreen roundId="none" onBack={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('このラウンドを読み込めませんでした。');
  });
});

describe('FacilityApp round input', () => {
  it('opens a round from home, and home shows the saved progress after going back', async () => {
    await seed(round());
    render(<FacilityApp />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '2026/11/20 14:30 環境整備 を開く' }));
    await user.click(await screen.findByRole('button', { name: /透析室/ }));
    await user.click(within(item('高頻度接触面が清拭されている')).getByRole('button', { name: '○' }));
    await waitFor(async () => expect(await storedMarks()).toMatchObject({ 透析室: { a: 'ok' } }));
    await user.click(screen.getByRole('button', { name: '部署の一覧へ戻る' }));
    await user.click(screen.getByRole('button', { name: 'ホームへ戻る' }));
    expect(screen.getByRole('region', { name: 'この端末のラウンド' })).toHaveTextContent('記入済み 2 / 5');
  });
});
