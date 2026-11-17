import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsScreen from '../../facility/SettingsScreen';
import type { FacilitySettings } from '../../facility/facilitySettings';
import { loadFacilitySettings, saveFacilitySettings } from '../../facility/facilityStorage';
import { readSettingsFile } from '../../facility/readSettingsFile';

// Keep the real reader by default; individual tests replace one result.
vi.mock('../../facility/readSettingsFile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../facility/readSettingsFile')>();
  return { ...actual, readSettingsFile: vi.fn(actual.readSettingsFile) };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// import.meta.url is an http URL under jsdom; vitest runs from the repository root.
const TEMPLATE_PATH = resolve(process.cwd(), 'public/facility-settings-template.xlsx');

function templateFile(): File {
  return new File([readFileSync(TEMPLATE_PATH)], 'facility-settings-template.xlsx');
}

function savedSettings(): FacilitySettings {
  return {
    version: 1,
    groups: [
      { name: '病棟', visit: 'always' },
      { name: '外来', visit: 'select' },
    ],
    departments: [
      { name: '3東', group: '病棟' },
      { name: '内科外来', group: '外来' },
      { name: '透析室', group: '外来' },
    ],
    themes: [
      {
        name: '手指衛生',
        items: [
          { id: 'a', text: '全部署の項目', targetGroups: [], excludedDepartments: [] },
          { id: 'b', text: '外来だけの項目', targetGroups: ['外来'], excludedDepartments: ['透析室'] },
          { id: 'c', text: '全部署から除く項目', targetGroups: [], excludedDepartments: ['3東', '透析室'] },
        ],
      },
    ],
    members: [
      { name: '看護 花子', role: '看護師' },
      { name: '医師 太郎', role: '医師' },
      { name: '看護 次郎', role: '看護師' },
    ],
  };
}

function setup() {
  const { container } = render(<SettingsScreen />);
  // The file input is visually hidden inside a label.
  const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!fileInput) throw new Error('file input not found');
  return { fileInput, user: userEvent.setup({ applyAccept: false }) };
}

function section(name: RegExp) {
  return screen.getByRole('region', { name });
}

describe('SettingsScreen', () => {
  it('shows the page title, an empty state and the template link', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1, name: '施設ラウンド' })).toBeInTheDocument();
    expect(screen.getByText('まだ施設設定が保存されていません。')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'ひな形をダウンロード' });
    expect(link).toHaveAttribute('href', `${import.meta.env.BASE_URL}facility-settings-template.xlsx`);
    expect(link).toHaveAttribute('download', 'facility-settings-template.xlsx');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the saved settings at start: departments per group, item targets and members per role', () => {
    saveFacilitySettings(savedSettings());
    setup();
    expect(screen.queryByText('まだ施設設定が保存されていません。')).not.toBeInTheDocument();
    expect(screen.getByText(/読み込み直すと、この設定は新しいファイルの内容に置き換わります/)).toBeInTheDocument();

    const groups = section(/部署グループと部署（2 グループ・3 部署）/);
    const [ward, outpatient] = within(groups).getAllByRole('listitem');
    expect(ward).toHaveTextContent('病棟回り方: 毎回3東');
    expect(outpatient).toHaveTextContent('外来回り方: 選ぶ内科外来、透析室');

    const items = section(/チェック項目（1 テーマ・3 項目）/);
    expect(within(items).getByRole('heading', { name: '手指衛生' })).toBeInTheDocument();
    expect(within(items).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '全部署の項目対象: 全部署',
      '外来だけの項目対象: 外来（透析室を除く）',
      '全部署から除く項目対象: 全部署（3東、透析室を除く）',
    ]);

    const members = section(/参加者（3 名）/);
    expect(within(members).getAllByRole('term').map((dt) => dt.textContent)).toEqual(['看護師', '医師']);
    expect(within(members).getAllByRole('definition').map((dd) => dd.textContent)).toEqual([
      '看護 花子、看護 次郎',
      '医師 太郎',
    ]);
  });

  it('reads the template, saves it and shows it', async () => {
    const { fileInput, user } = setup();
    await user.upload(fileInput, templateFile());
    expect(await screen.findByRole('region', { name: /部署グループと部署（4 グループ・11 部署）/ })).toBeInTheDocument();
    expect(section(/チェック項目（3 テーマ・10 項目）/)).toBeInTheDocument();
    expect(section(/参加者（5 名）/)).toBeInTheDocument();
    expect(loadFacilitySettings()?.departments).toHaveLength(11);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('lists errors with sheet and row, keeps the saved settings and says so', async () => {
    saveFacilitySettings(savedSettings());
    vi.mocked(readSettingsFile).mockResolvedValueOnce({
      ok: false,
      errors: [
        { sheet: '部署', row: 5, message: 'グループ「外来ウ」が「グループ」シートにありません' },
        { sheet: '参加者', message: '「参加者」シートがありません' },
        { message: 'Excel ファイル（.xlsx）を選んでください' },
      ],
    });
    const { fileInput, user } = setup();
    await user.upload(fileInput, templateFile());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('読み込めませんでした（3 件）');
    expect(within(alert).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '・「部署」シートの 5 行目: グループ「外来ウ」が「グループ」シートにありません',
      '・「参加者」シートがありません',
      '・Excel ファイル（.xlsx）を選んでください',
    ]);
    expect(alert).toHaveTextContent('保存している設定は変わっていません。');
    expect(section(/部署グループと部署（2 グループ・3 部署）/)).toBeInTheDocument();
    expect(loadFacilitySettings()).toEqual(savedSettings());
  });

  it('does not claim saved settings are kept when there were none', async () => {
    vi.mocked(readSettingsFile).mockResolvedValueOnce({ ok: false, errors: [{ message: '読めません' }] });
    const { fileInput, user } = setup();
    await user.upload(fileInput, templateFile());
    const alert = await screen.findByRole('alert');
    expect(alert).not.toHaveTextContent('保存している設定は変わっていません。');
    expect(screen.getByText('まだ施設設定が保存されていません。')).toBeInTheDocument();
    expect(loadFacilitySettings()).toBeNull();
  });

  it('reports a failed save and keeps showing the saved settings', async () => {
    saveFacilitySettings(savedSettings());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { fileInput, user } = setup();
    await user.upload(fileInput, templateFile());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('読み込んだ設定をこの端末に保存できませんでした');
    expect(alert).toHaveTextContent('保存している設定は変わっていません。');
    expect(section(/部署グループと部署（2 グループ・3 部署）/)).toBeInTheDocument();
  });

  it('reports a failed save without claiming earlier settings when there were none', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    const { fileInput, user } = setup();
    await user.upload(fileInput, templateFile());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('読み込んだ設定をこの端末に保存できませんでした');
    expect(alert).not.toHaveTextContent('保存している設定は変わっていません。');
    expect(screen.getByText('まだ施設設定が保存されていません。')).toBeInTheDocument();
  });

  it('shows no back button without onBack, and disables it while reading a file', async () => {
    expect(render(<SettingsScreen />).queryByRole('button', { name: 'ホームへ戻る' })).toBeNull();
    cleanup();
    let resolve: () => void = () => {};
    vi.mocked(readSettingsFile).mockImplementationOnce(
      () => new Promise((r) => { resolve = () => r({ ok: false, errors: [{ message: '読めません' }] }); })
    );
    const onBack = vi.fn();
    const { container } = render(<SettingsScreen onBack={onBack} />);
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error('file input not found');
    const user = userEvent.setup({ applyAccept: false });
    const back = screen.getByRole('button', { name: 'ホームへ戻る' });
    await user.upload(fileInput, templateFile());
    expect(back).toBeDisabled();
    await user.click(back);
    expect(onBack).not.toHaveBeenCalled();
    resolve();
    await screen.findByRole('alert');
    expect(back).toBeEnabled();
    await user.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('disables the file input while reading and lets the same file be picked again', async () => {
    let resolve: () => void = () => {};
    vi.mocked(readSettingsFile).mockImplementationOnce(
      () => new Promise((r) => { resolve = () => r({ ok: false, errors: [{ message: '読めません' }] }); })
    );
    const { fileInput, user } = setup();
    await user.upload(fileInput, templateFile());
    expect(fileInput).toBeDisabled();
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    // The value is cleared so choosing the same file again still fires change.
    expect(fileInput.value).toBe('');
    resolve();
    await screen.findByRole('alert');
    expect(fileInput).toBeEnabled();
    expect(screen.getByText('ファイルを選ぶ')).toBeInTheDocument();
  });
});
