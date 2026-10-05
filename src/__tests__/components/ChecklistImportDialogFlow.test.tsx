import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChecklistImportDialog from '../../components/ChecklistImportDialog';
import { trackEvent } from '../../analytics';

vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));

const VALID_CSV = '手指衛生,手指消毒剤が配置されている\n個人防護具,手袋が適切に廃棄されている';
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function fixtureFile(name: string) {
  const bytes = readFileSync(resolve(process.cwd(), 'src/__tests__/fixtures', name));
  return new File([bytes], name, { type: XLSX_TYPE });
}

function setup() {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const { container } = render(<ChecklistImportDialog onSave={onSave} onCancel={onCancel} />);
  const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!fileInput) throw new Error('file input not found');
  return { onSave, onCancel, fileInput, user: userEvent.setup() };
}

function saveButton() {
  return screen.getByRole('button', { name: '保存して適用' });
}

beforeEach(() => {
  vi.mocked(trackEvent).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('ChecklistImportDialog: reading files', () => {
  it('records that the dialog was opened, once', () => {
    setup();
    expect(vi.mocked(trackEvent).mock.calls).toEqual([['checklist_import_open']]);
  });

  it('reads an .xlsx file, previews it and saves it as xlsx', async () => {
    const { onSave, fileInput, user } = setup();
    await user.upload(fileInput, fixtureFile('checklist-normal.xlsx'));

    expect(await screen.findByText('3カテゴリ・7項目')).toBeInTheDocument();
    expect(screen.getByText('checklist-normal.xlsx')).toBeInTheDocument();
    await user.click(saveButton());
    expect(onSave.mock.calls[0][0].name).toBe('checklist-normal');
    expect(onSave.mock.calls[0][0].categories.map((c: { category: string }) => c.category)).toEqual([
      '手指衛生',
      '個人防護具',
      '環境整備',
    ]);
    expect(trackEvent).toHaveBeenLastCalledWith('checklist_import_success', { file_type: 'xlsx' });
  });

  it('reads any other extension as CSV', async () => {
    const { onSave, fileInput, user } = setup();
    // user.upload honours the accept attribute, so bypass it as a file manager could
    fireEvent.change(fileInput, { target: { files: [new File([VALID_CSV], 'list.txt', { type: 'text/plain' })] } });
    expect(await screen.findByText('2カテゴリ・2項目')).toBeInTheDocument();
    await user.click(saveButton());
    expect(onSave.mock.calls[0][0].name).toBe('list');
    expect(trackEvent).toHaveBeenLastCalledWith('checklist_import_success', { file_type: 'csv' });
  });

  it('records a failed CSV read with its file type and does not record success', async () => {
    const { fileInput, user } = setup();
    await user.upload(fileInput, new File([''], 'empty.csv', { type: 'text/csv' }));
    await screen.findByRole('alert');
    expect(trackEvent).toHaveBeenLastCalledWith('checklist_import_error', { file_type: 'csv' });
    expect(trackEvent).not.toHaveBeenCalledWith('checklist_import_success', expect.anything());
  });

  it('records a failed .xlsx read with its file type', async () => {
    const { fileInput, user } = setup();
    await user.upload(fileInput, new File(['not a zip'], 'broken.xlsx', { type: XLSX_TYPE }));
    await screen.findByRole('alert');
    expect(trackEvent).toHaveBeenLastCalledWith('checklist_import_error', { file_type: 'xlsx' });
  });

  it('shows 読み込み中 while the file is being read and the file name right away', async () => {
    const { fileInput, user } = setup();
    let release: (text: string) => void = () => {};
    const file = new File([VALID_CSV], 'slow.csv', { type: 'text/csv' });
    vi.spyOn(file, 'text').mockReturnValue(new Promise((resolve) => (release = resolve)));

    await user.upload(fileInput, file);
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    expect(screen.getByText('slow.csv')).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();

    release(VALID_CSV);
    expect(await screen.findByText('2カテゴリ・2項目')).toBeInTheDocument();
    expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument();
  });

  it('shows a fallback message when the reader throws something other than an Error', async () => {
    const { onSave, fileInput, user } = setup();
    const file = new File([VALID_CSV], 'odd.csv', { type: 'text/csv' });
    vi.spyOn(file, 'text').mockRejectedValue('boom');
    await user.upload(fileInput, file);
    expect(await screen.findByRole('alert')).toHaveTextContent('読み込みに失敗しました');
    await user.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('clears a previous error when a good file is loaded next', async () => {
    const { fileInput, user } = setup();
    await user.upload(fileInput, new File([''], 'empty.csv', { type: 'text/csv' }));
    await screen.findByRole('alert');
    await user.upload(fileInput, new File([VALID_CSV], 'good.csv', { type: 'text/csv' }));
    await screen.findByText('2カテゴリ・2項目');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does nothing when the picker is closed without a file', async () => {
    const { fileInput, user } = setup();
    await user.upload(fileInput, []);
    expect(screen.getByText('タップしてファイルを選択 (.csv / .xlsx)')).toBeInTheDocument();
    expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });
});

describe('ChecklistImportDialog: saving', () => {
  it('saves with a generated ID, the creation time and the fields in a fixed order', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const now = new Date('2026-10-06T00:05:03.000Z');
    vi.setSystemTime(now);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const { onSave, fileInput, user } = setup();
    await user.upload(fileInput, new File([VALID_CSV], 'a.csv', { type: 'text/csv' }));
    await screen.findByText('2カテゴリ・2項目');
    await user.click(saveButton());

    const saved = onSave.mock.calls[0][0];
    // (0.5).toString(36) is "0.i"
    expect(saved.id).toBe('i' + now.getTime().toString(36));
    expect(saved.createdAt).toBe('2026-10-06T00:05:03.000Z');
    expect(Object.keys(saved)).toEqual(['id', 'name', 'createdAt', 'categories']);
  });

  it('falls back to 取込チェックリスト when neither a name nor a file name stem is available', async () => {
    const { onSave, fileInput, user } = setup();
    await user.type(screen.getByPlaceholderText('例: 3階東病棟専用'), '   ');
    await user.upload(fileInput, new File([VALID_CSV], '.csv', { type: 'text/csv' }));
    await screen.findByText('2カテゴリ・2項目');
    await user.click(saveButton());
    expect(onSave.mock.calls[0][0].name).toBe('取込チェックリスト');
  });

  it('strips only the last extension from the file name', async () => {
    const { onSave, fileInput, user } = setup();
    await user.upload(fileInput, new File([VALID_CSV], '3東.v2.csv', { type: 'text/csv' }));
    await screen.findByText('2カテゴリ・2項目');
    await user.click(saveButton());
    expect(onSave.mock.calls[0][0].name).toBe('3東.v2');
  });
});
