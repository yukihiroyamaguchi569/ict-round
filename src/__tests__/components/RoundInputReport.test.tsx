import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveAs } from 'file-saver';
import RoundInputScreen from '../../facility/RoundInputScreen';
import { openFacilityDb } from '../../facility/roundDb';
import { buildFacilityDocxBlob } from '../../facility/facilityDocx';
import { loadFacilityRoundFile } from '../../facility/facilityReportFile';
import type { FacilityRound } from '../../facility/facilityRound';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('../../facility/facilityDocx', () => ({ buildFacilityDocxBlob: vi.fn() }));
vi.mock('../../facility/facilityReportFile', () => ({
  embedFacilityRoundExport: vi.fn((blob: Blob) => Promise.resolve(blob)),
  loadFacilityRoundFile: vi.fn(),
}));

let factory: IDBFactory;
let finishBuild: (blob: Blob) => void;
let failBuild: (err: Error) => void;

beforeEach(() => {
  vi.stubEnv('TZ', 'Asia/Tokyo');
  factory = new IDBFactory();
  vi.stubGlobal('indexedDB', factory);
  vi.mocked(buildFacilityDocxBlob).mockImplementation(
    () => new Promise((resolve, reject) => { finishBuild = resolve; failBuild = reject; })
  );
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'canShare');
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
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
      { id: 'b', text: '汚物処理室に汚れがない', targetGroups: [], excludedDepartments: [] },
      { id: 'c', text: 'リネンが分けて置かれている', targetGroups: [], excludedDepartments: [] },
    ],
    departments: [
      { name: '3東', group: '病棟' },
      { name: '3西', group: '病棟' },
      { name: '透析室', group: '外来' },
    ],
    members: [],
    marks: { '3東': { a: 'ok', b: 'ok', c: 'ng' }, 透析室: { a: 'ng' } },
    departmentComments: {},
    overallComment: '',
    photos: [],
  };
}

async function openReport() {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('seed: open failed');
  await open.value.putRound(round());
  open.value.close();
  render(<RoundInputScreen roster={null} roundId="r1" onBack={vi.fn()} />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: '帳票（遵守率と Word 出力）' }));
  return user;
}

function row(group: string, department: string) {
  const item = within(screen.getByRole('region', { name: group })).getByText(department).closest('li');
  if (!item) throw new Error(`no row for ${department}`);
  return item;
}

describe('RoundInputScreen report', () => {
  it('opens the report from the card below the overall card, and goes back to the list', async () => {
    const user = await openReport();

    expect(screen.getByRole('heading', { name: '帳票' })).toHaveFocus();
    expect(screen.getByText('書き出した Word が、この端末の記録の控えになります。ほかの端末で取り込むこともできます。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^3東/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '部署の一覧へ戻る' }));
    expect(screen.getByRole('heading', { name: '部署の一覧' })).toHaveFocus();
    const cards = screen.getAllByRole('button', { name: /^(全体|帳票)/ });
    expect(cards.map((c) => c.getAttribute('aria-label'))).toEqual(['全体（総評と参加者）', '帳票（遵守率と Word 出力）']);
  });

  it('lists ○, × and the compliance rate per department by group, with "－" when nothing is marked', async () => {
    await openReport();

    expect(row('病棟', '3東')).toHaveTextContent('3東○ 2× 1遵守率 67%');
    expect(row('病棟', '3西')).toHaveTextContent('3西○ 0× 0遵守率 －');
    expect(row('外来', '透析室')).toHaveTextContent('透析室○ 0× 1遵守率 0%');
  });

  it('shows the pending label with the button disabled, then the enabled Word export that downloads the file', async () => {
    const user = await openReport();
    const pending = await screen.findByRole('button', { name: '準備中…' });
    expect(pending).toBeDisabled();
    expect(buildFacilityDocxBlob).toHaveBeenCalledTimes(1);

    finishBuild(new Blob(['docx']));
    const exportButton = await screen.findByRole('button', { name: 'Word出力' });
    expect(exportButton).toBeEnabled();
    expect(screen.queryByRole('button', { name: '準備中…' })).not.toBeInTheDocument();

    await user.click(exportButton);
    expect(saveAs).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveAs).mock.calls[0][1]).toMatch(/^ICTround_facility_2026-11-20_[a-z0-9]{4}\.docx$/);
  });

  it('offers sharing on a device that can share files', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    const user = await openReport();
    finishBuild(new Blob(['docx']));

    await user.click(await screen.findByRole('button', { name: '共有' }));
    expect(share).toHaveBeenCalledTimes(1);
    expect(saveAs).not.toHaveBeenCalled();
  });

  it('says the file cannot be made when the build fails, with the button kept disabled', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await openReport();
    await screen.findByRole('button', { name: '準備中…' });

    failBuild(new Error('too big'));
    expect(await screen.findByRole('button', { name: '作成できません' })).toBeDisabled();
    expect(screen.getByText(/報告書ファイルを作成できませんでした（too big）/)).toBeInTheDocument();
  });

  it('keeps the round from being left while a file is being imported, until the import is done', async () => {
    let finish: (result: Awaited<ReturnType<typeof loadFacilityRoundFile>>) => void = () => {};
    vi.mocked(loadFacilityRoundFile).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const onBack = vi.fn();
    const open = await openFacilityDb(factory);
    if (!open.ok) throw new Error('seed: open failed');
    await open.value.putRound(round());
    open.value.close();
    render(<RoundInputScreen roster={null} roundId="r1" onBack={onBack} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '帳票（遵守率と Word 出力）' }));

    await user.upload(screen.getByLabelText('Word のファイルを選ぶ'), new File(['x'], 'b.docx'));
    expect(screen.getByLabelText('取り込み中...')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '部署の一覧へ戻る' }));
    const home = screen.getByRole('button', { name: 'ホームへ戻る' });
    expect(home).toBeDisabled();

    finish({ ok: false, reason: 'not-docx' });
    await waitFor(() => expect(home).toBeEnabled());
    await user.click(home);
    await waitFor(() => expect(onBack).toHaveBeenCalledTimes(1));
  });
});
