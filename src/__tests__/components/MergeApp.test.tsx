import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveAs } from 'file-saver';
import MergeApp from '../../merge/MergeApp';
import { buildMergedDocxBlob } from '../../merge/mergedDocx';
import { makeEmptyDocx, makeRoundDocxFile } from '../fixtures/roundDocx';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));

// Keep the real Word builder by default; individual tests make it fail once.
vi.mock('../../merge/mergedDocx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../merge/mergedDocx')>();
  return { ...actual, buildMergedDocxBlob: vi.fn(actual.buildMergedDocxBlob) };
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup() {
  const { container } = render(<MergeApp />);
  // The file input is visually hidden inside a label and has no accessible name
  const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!fileInput) throw new Error('file input not found');
  // A file picker can still pick non-.docx files ("All files"), so do not filter by accept
  return { fileInput, user: userEvent.setup({ applyAccept: false }) };
}

/** The loaded-report list card, found from its heading */
async function findLoadedList(count: number) {
  const heading = await screen.findByRole('heading', { name: new RegExp(`読み込んだ報告書（${count}件）`) });
  const card = heading.parentElement;
  if (!card) throw new Error('loaded list card not found');
  return card;
}

function loadedItems(card: HTMLElement) {
  return within(card).getAllByRole('listitem');
}

/** Department column headers of the preview table (the first header is the item column) */
function columnHeaders() {
  return screen.getAllByRole('columnheader').slice(1).map((th) => th.textContent);
}

/** Rating cells of the preview row for one checklist item */
function ratingsOf(description: string) {
  const row = screen.getByRole('cell', { name: description }).closest('tr');
  if (!row) throw new Error(`row not found: ${description}`);
  return within(row).getAllByRole('cell').slice(1).map((td) => td.textContent);
}

describe('MergeApp', () => {
  it('shows two departments as two columns with their ratings', async () => {
    const { fileInput, user } = setup();
    await user.upload(fileInput, [
      await makeRoundDocxFile('3east.docx', { wardName: '3階東病棟', inspectorName: '田中', ratings: { h1: 'A', h2: 'C' } }),
      await makeRoundDocxFile('5west.docx', { wardName: '5階西病棟', inspectorName: '鈴木', ratings: { h1: 'B', e1: 'A' } }),
    ]);

    const list = await findLoadedList(2);
    expect(within(list).getByText(/表は2列/)).toBeInTheDocument();
    expect(loadedItems(list).map((li) => li.textContent)).toEqual([
      expect.stringContaining('3階東病棟'),
      expect.stringContaining('5階西病棟'),
    ]);
    expect(within(list).getByText(/担当: 田中/)).toBeInTheDocument();
    expect(within(list).getByText(/評価 2\/3項目.*3east\.docx/)).toBeInTheDocument();
    expect(within(list).queryByText(/同じ病棟の報告書と1列にまとまります/)).not.toBeInTheDocument();

    expect(columnHeaders()).toEqual(['3階東病棟', '5階西病棟']);
    expect(ratingsOf('手指消毒剤が配置されている')).toEqual(['A', 'B']);
    expect(ratingsOf('5つのタイミングが掲示されている')).toEqual(['C', '—']);
    expect(ratingsOf('ゴミ箱に蓋がある')).toEqual(['—', 'A']);
    expect(screen.queryByText('確認してください')).not.toBeInTheDocument();
    expect(screen.queryByText('読み込めなかったファイル')).not.toBeInTheDocument();
  });

  it('merges reports of the same ward into one column and warns about split ratings', async () => {
    const { fileInput, user } = setup();
    await user.upload(fileInput, [
      await makeRoundDocxFile('a.docx', { wardName: '5階西病棟', inspectorName: '田中', ratings: { h1: 'A', h2: 'B' } }),
      // Surrounding spaces are ignored when matching ward names
      await makeRoundDocxFile('b.docx', { wardName: ' 5階西病棟 ', inspectorName: '鈴木', ratings: { h1: 'C', h2: 'B' } }),
    ]);

    const list = await findLoadedList(2);
    expect(within(list).getByText(/表は1列/)).toBeInTheDocument();
    expect(within(list).getAllByText(/同じ病棟の報告書と1列にまとまります/)).toHaveLength(2);

    expect(columnHeaders()).toEqual(['5階西病棟']);
    // The stricter rating wins when inspectors disagree
    expect(ratingsOf('手指消毒剤が配置されている')).toEqual(['C']);
    expect(ratingsOf('5つのタイミングが掲示されている')).toEqual(['B']);

    const warningTitle = screen.getByText('確認してください');
    const warnings = within(warningTitle.parentElement ?? document.body).getAllByRole('listitem');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toHaveTextContent('担当者間で評価が分かれました');
    expect(warnings[0]).toHaveTextContent('手指消毒剤が配置されている');
    expect(warnings[0]).toHaveTextContent('田中: A');
    expect(warnings[0]).toHaveTextContent('鈴木: C');
  });

  it('does not merge reports without a ward name', async () => {
    const { fileInput, user } = setup();
    await user.upload(fileInput, [
      await makeRoundDocxFile('a.docx', { wardName: '', inspectorName: '田中' }),
      await makeRoundDocxFile('b.docx', { wardName: '', inspectorName: '鈴木' }),
    ]);

    const list = await findLoadedList(2);
    expect(within(list).getAllByText('（部署名なし）', { exact: false })).toHaveLength(2);
    expect(within(list).queryByText(/同じ病棟の報告書と1列にまとまります/)).not.toBeInTheDocument();
    expect(columnHeaders()).toEqual(['田中', '鈴木']);
  });

  it('lists unreadable files by name and clears the list after a successful load', async () => {
    const { fileInput, user } = setup();
    await user.upload(fileInput, [
      new File(['ただのテキスト'], 'memo.txt', { type: 'text/plain' }),
      new File([await makeEmptyDocx()], 'old-report.docx'),
    ]);

    const errorTitle = await screen.findByText('読み込めなかったファイル');
    const errors = within(errorTitle.parentElement ?? document.body).getAllByRole('listitem');
    expect(errors).toHaveLength(2);
    expect(errors[0]).toHaveTextContent(/memo\.txt: Wordファイル（\.docx）ではありません/);
    expect(errors[1]).toHaveTextContent(/old-report\.docx: このWordファイルにはラウンドデータが入っていません/);
    // Nothing was loaded, so there is no list, preview or export button
    expect(screen.queryByRole('heading', { name: /読み込んだ報告書/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Word出力' })).not.toBeInTheDocument();

    await user.upload(fileInput, await makeRoundDocxFile('ok.docx', { wardName: '3階東病棟' }));

    await findLoadedList(1);
    expect(screen.queryByText('読み込めなかったファイル')).not.toBeInTheDocument();
  });

  it('loads the readable files of a mixed selection and reports the rest', async () => {
    const { fileInput, user } = setup();
    await user.upload(fileInput, [
      await makeRoundDocxFile('ok.docx', { wardName: '3階東病棟' }),
      new File(['ただのテキスト'], 'memo.txt'),
    ]);

    await findLoadedList(1);
    expect(columnHeaders()).toEqual(['3階東病棟']);
    expect(screen.getByText(/memo\.txt:/)).toBeInTheDocument();
  });

  it('reorders and removes reports, updating both the list and the columns', async () => {
    const { fileInput, user } = setup();
    await user.upload(fileInput, [
      await makeRoundDocxFile('a.docx', { wardName: 'A病棟' }),
      await makeRoundDocxFile('b.docx', { wardName: 'B病棟' }),
      await makeRoundDocxFile('c.docx', { wardName: 'C病棟' }),
    ]);
    const list = await findLoadedList(3);
    const wardOrder = () => loadedItems(list).map((li) => li.textContent?.match(/[ABC]病棟/)?.[0]);

    let items = loadedItems(list);
    expect(within(items[0]).getByRole('button', { name: '上へ' })).toBeDisabled();
    expect(within(items[0]).getByRole('button', { name: '下へ' })).toBeEnabled();
    expect(within(items[1]).getByRole('button', { name: '上へ' })).toBeEnabled();
    expect(within(items[1]).getByRole('button', { name: '下へ' })).toBeEnabled();
    expect(within(items[2]).getByRole('button', { name: '上へ' })).toBeEnabled();
    expect(within(items[2]).getByRole('button', { name: '下へ' })).toBeDisabled();

    await user.click(within(items[0]).getByRole('button', { name: '下へ' }));
    expect(wardOrder()).toEqual(['B病棟', 'A病棟', 'C病棟']);
    expect(columnHeaders()).toEqual(['B病棟', 'A病棟', 'C病棟']);

    items = loadedItems(list);
    await user.click(within(items[2]).getByRole('button', { name: '上へ' }));
    expect(wardOrder()).toEqual(['B病棟', 'C病棟', 'A病棟']);
    expect(columnHeaders()).toEqual(['B病棟', 'C病棟', 'A病棟']);

    items = loadedItems(list);
    await user.click(within(items[1]).getByRole('button', { name: '削除' }));
    expect(screen.getByRole('heading', { name: /読み込んだ報告書（2件）/ })).toBeInTheDocument();
    expect(wardOrder()).toEqual(['B病棟', 'A病棟']);
    expect(columnHeaders()).toEqual(['B病棟', 'A病棟']);
  });

  it('hides the list and preview after removing the last report', async () => {
    const { fileInput, user } = setup();
    await user.upload(fileInput, await makeRoundDocxFile('a.docx', { wardName: 'A病棟' }));
    const list = await findLoadedList(1);

    await user.click(within(list).getByRole('button', { name: '削除' }));

    expect(screen.queryByRole('heading', { name: /読み込んだ報告書/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Word出力' })).not.toBeInTheDocument();
  });

  it('saves the merged report as a dated .docx', async () => {
    // Fake only Date so userEvent's timers keep running
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-05T12:00:00Z'));
    const { fileInput, user } = setup();
    await user.upload(fileInput, [
      await makeRoundDocxFile('a.docx', { wardName: 'A病棟', ratings: { h1: 'A' } }),
      await makeRoundDocxFile('b.docx', { wardName: 'B病棟', ratings: { h1: 'C' } }),
    ]);
    await findLoadedList(2);

    await user.click(screen.getByRole('button', { name: 'Word出力' }));

    await waitFor(() => expect(saveAs).toHaveBeenCalledTimes(1));
    const [blob, filename] = vi.mocked(saveAs).mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect((blob as Blob).size).toBeGreaterThan(0);
    expect(filename).toBe('ICTround_merged_2026-10-05.docx');
    expect(vi.mocked(buildMergedDocxBlob).mock.calls[0][0].columns.map((c) => c.label)).toEqual(['A病棟', 'B病棟']);
    expect(await screen.findByRole('button', { name: 'Word出力' })).toBeEnabled();
    expect(screen.queryByText(/Word出力に失敗しました/)).not.toBeInTheDocument();
  });

  it('shows an error and saves nothing when building the Word file fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(buildMergedDocxBlob).mockRejectedValueOnce(new Error('docx broke'));
    const { fileInput, user } = setup();
    await user.upload(fileInput, await makeRoundDocxFile('a.docx', { wardName: 'A病棟' }));
    await findLoadedList(1);

    await user.click(screen.getByRole('button', { name: 'Word出力' }));

    expect(await screen.findByText(/Word出力に失敗しました: docx broke/)).toBeInTheDocument();
    expect(buildMergedDocxBlob).toHaveBeenCalledTimes(1);
    expect(saveAs).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    // The loaded report stays and the button can be pressed again
    expect(screen.getByRole('heading', { name: /読み込んだ報告書（1件）/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Word出力' })).toBeEnabled();
  });

  it('loads a report dropped onto the drop zone', async () => {
    setup();
    const dropZone = screen.getByText('ここに報告書の .docx ファイルをドラッグ&ドロップ').parentElement;
    if (!dropZone) throw new Error('drop zone not found');

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [await makeRoundDocxFile('dropped.docx', { wardName: 'ICU', ratings: { e1: 'B' } })] },
    });

    const list = await findLoadedList(1);
    expect(within(list).getByText(/dropped\.docx/)).toBeInTheDocument();
    expect(columnHeaders()).toEqual(['ICU']);
    expect(ratingsOf('ゴミ箱に蓋がある')).toEqual(['B']);
  });
});
