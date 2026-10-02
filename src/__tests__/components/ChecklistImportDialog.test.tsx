// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChecklistImportDialog from '../../components/ChecklistImportDialog';

const VALID_CSV = [
  'category,description',
  '手指衛生,手指消毒剤が配置されている',
  '手指衛生,5つのタイミングが掲示されている',
  '個人防護具,手袋が適切に廃棄されている',
].join('\n');

function setup() {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const { container } = render(<ChecklistImportDialog onSave={onSave} onCancel={onCancel} />);
  // The file input is visually hidden behind a button and has no accessible name
  const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!fileInput) throw new Error('file input not found');
  return { onSave, onCancel, fileInput, user: userEvent.setup() };
}

function saveButton() {
  return screen.getByRole('button', { name: '保存して適用' });
}

describe('ChecklistImportDialog', () => {
  it('disables save until a file is loaded', () => {
    setup();
    expect(saveButton()).toBeDisabled();
  });

  it('previews a valid CSV and saves it with the file name as the default name', async () => {
    const { onSave, onCancel, fileInput, user } = setup();
    await user.upload(fileInput, new File([VALID_CSV], '3東専用.csv', { type: 'text/csv' }));

    expect(await screen.findByText('2カテゴリ・3項目')).toBeInTheDocument();
    expect(screen.getByText('手指衛生（2項目）')).toBeInTheDocument();
    expect(screen.getByText('個人防護具（1項目）')).toBeInTheDocument();

    await user.click(saveButton());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    const saved = onSave.mock.calls[0][0];
    expect(saved.name).toBe('3東専用');
    expect(saved.id).toEqual(expect.any(String));
    expect(saved.categories.map((c: { category: string }) => c.category)).toEqual(['手指衛生', '個人防護具']);
    expect(saved.categories[0].items.map((i: { description: string }) => i.description)).toEqual([
      '手指消毒剤が配置されている',
      '5つのタイミングが掲示されている',
    ]);
  });

  it('uses the typed name (trimmed) over the file name', async () => {
    const { onSave, fileInput, user } = setup();
    await user.type(screen.getByPlaceholderText('例: 3階東病棟専用'), '  外来用  ');
    await user.upload(fileInput, new File([VALID_CSV], 'list.csv', { type: 'text/csv' }));
    await screen.findByText('2カテゴリ・3項目');
    await user.click(saveButton());
    expect(onSave.mock.calls[0][0].name).toBe('外来用');
  });

  it('shows an error and does not save when the CSV has no valid rows', async () => {
    const { onSave, fileInput, user } = setup();
    await user.upload(fileInput, new File(['only-one-column\nanother'], 'bad.csv', { type: 'text/csv' }));

    expect(await screen.findByText(/有効な行が見つかりません/)).toBeInTheDocument();
    expect(screen.queryByText('プレビュー')).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    await user.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows an error and does not save for an empty file', async () => {
    const { onSave, fileInput, user } = setup();
    await user.upload(fileInput, new File([''], 'empty.csv', { type: 'text/csv' }));

    expect(await screen.findByText(/有効な行が見つかりません/)).toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    await user.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows an error and does not save for a broken .xlsx file', async () => {
    const { onSave, fileInput, user } = setup();
    await user.upload(
      fileInput,
      new File(['this is not a zip archive'], 'broken.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );

    // The error text comes from the xlsx library, so only check that an error is shown
    await vi.waitFor(() => expect(document.querySelector('.text-red-600')).not.toBeNull());
    expect(screen.queryByText('読み込み中...')).not.toBeInTheDocument();
    expect(screen.queryByText('プレビュー')).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    await user.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('clears a previous preview when a bad file is loaded next', async () => {
    const { onSave, fileInput, user } = setup();
    await user.upload(fileInput, new File([VALID_CSV], 'good.csv', { type: 'text/csv' }));
    await screen.findByText('2カテゴリ・3項目');

    await user.upload(fileInput, new File([''], 'empty.csv', { type: 'text/csv' }));
    expect(await screen.findByText(/有効な行が見つかりません/)).toBeInTheDocument();
    expect(screen.queryByText('2カテゴリ・3項目')).not.toBeInTheDocument();
    expect(saveButton()).toBeDisabled();
    await user.click(saveButton());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls only onCancel when キャンセル is pressed', async () => {
    const { onSave, onCancel, user } = setup();
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
