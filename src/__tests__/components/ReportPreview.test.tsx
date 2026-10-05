import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveAs } from 'file-saver';
import ReportPreview from '../../components/ReportPreview';
import { buildDocxBlob } from '../../docx';
import { embedRoundExport } from '../../roundExportDocx';
import { trackEvent } from '../../analytics';
import { ThemeProvider } from '../../ThemeContext';
import type { ChecklistCategory, RoundData } from '../../types';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));
// The tests are about the file name and share text, so skip the real Word build
vi.mock('../../docx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../docx')>();
  return { ...actual, buildDocxBlob: vi.fn(() => Promise.resolve(new Blob(['docx']))) };
});
vi.mock('../../roundExportDocx', () => ({ embedRoundExport: vi.fn((blob: Blob) => Promise.resolve(blob)) }));

const categories: ChecklistCategory[] = [
  { category: '手指衛生', items: [{ id: 'h1', category: '手指衛生', description: '手指消毒剤が配置されている' }] },
];

const roundData: RoundData = {
  inspectorName: '田中',
  wardName: '3階東病棟',
  startTime: '2026/10/06 07:00',
  checklistResults: [{ itemId: 'h1', rating: 'A', photos: [] }],
  generalPhotos: [],
  overallEvaluation: '',
};

const FILE_NAME = /^ICTround_(\d{4}-\d{2}-\d{2})_[a-z0-9]{1,4}\.docx$/;

function renderPreview() {
  render(
    <ThemeProvider>
      <ReportPreview roundData={roundData} categories={categories} onBack={() => {}} />
    </ThemeProvider>,
  );
  return userEvent.setup();
}

function stubShare() {
  const share = vi.fn<(data: ShareData) => Promise<void>>(() => Promise.resolve());
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
  return share;
}

/** The single ShareData object passed to navigator.share */
function sharedData(share: ReturnType<typeof stubShare>) {
  expect(share).toHaveBeenCalledTimes(1);
  const data = share.mock.calls[0][0];
  const file = data.files?.[0];
  if (!file) throw new Error('no file was shared');
  return { fileName: file.name, text: data.text };
}

beforeEach(() => {
  // 07:00 JST on 2026-10-06 is still 2026-10-05 in UTC
  vi.stubEnv('TZ', 'Asia/Tokyo');
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-05T22:00:00Z'));
});

afterEach(() => {
  // Remove the own properties so jsdom's navigator has no share API again
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'canShare');
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('ReportPreview file name and share text', () => {
  it('shares a file named with the local date and the same date in the text', async () => {
    const share = stubShare();
    const user = renderPreview();

    await user.click(await screen.findByRole('button', { name: '共有' }));

    const { fileName, text } = sharedData(share);
    expect(fileName).toMatch(FILE_NAME);
    expect(fileName.match(FILE_NAME)?.[1]).toBe('2026-10-06');
    expect(text).toBe('田中 - 2026-10-06');
  });

  it('keeps the share text on the file name date when midnight passes after the preview opens', async () => {
    vi.setSystemTime(new Date('2026-10-05T14:59:00Z')); // 23:59 JST on 2026-10-05
    const share = stubShare();
    const user = renderPreview();
    const shareButton = await screen.findByRole('button', { name: '共有' });

    vi.setSystemTime(new Date('2026-10-05T15:01:00Z')); // 00:01 JST on 2026-10-06
    await user.click(shareButton);

    const { fileName, text } = sharedData(share);
    expect(fileName.match(FILE_NAME)?.[1]).toBe('2026-10-05');
    expect(text).toBe('田中 - 2026-10-05');
  });

  it('downloads a file named with the local date when sharing files is not supported', async () => {
    const user = renderPreview();

    await user.click(await screen.findByRole('button', { name: 'Word出力' }));

    expect(saveAs).toHaveBeenCalledTimes(1);
    const fileName = vi.mocked(saveAs).mock.calls[0][1];
    expect(fileName).toMatch(FILE_NAME);
    expect(fileName?.match(FILE_NAME)?.[1]).toBe('2026-10-06');
  });

  it('falls back to download with the same local date when canShare rejects files', async () => {
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true });
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true });
    const user = renderPreview();

    await user.click(await screen.findByRole('button', { name: 'Word出力' }));

    expect(navigator.share).not.toHaveBeenCalled();
    const fileName = vi.mocked(saveAs).mock.calls[0][1];
    expect(fileName?.match(FILE_NAME)?.[1]).toBe('2026-10-06');
  });
});

describe('ReportPreview building the report file', () => {
  it('shows the pending label with the buttons disabled until the file is built', async () => {
    let finish: (blob: Blob) => void = () => {};
    vi.mocked(buildDocxBlob).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    stubShare();
    renderPreview();

    expect(screen.getByRole('button', { name: '準備中…' })).toBeDisabled();

    finish(new Blob(['docx']));
    expect(await screen.findByRole('button', { name: '共有' })).toBeEnabled();
  });

  it('embeds the round data with its checklist into the report built from the same round', async () => {
    renderPreview();
    await screen.findByRole('button', { name: 'Word出力' });

    expect(buildDocxBlob).toHaveBeenCalledWith(roundData, categories);
    expect(embedRoundExport).toHaveBeenCalledTimes(1);
    expect(vi.mocked(embedRoundExport).mock.calls[0][1]).toEqual({
      format: 'meguru-round',
      version: 1,
      exportedAt: '2026-10-05T22:00:00.000Z',
      checklistName: '',
      categories,
      roundData,
    });
  });

  it('keeps the checklist name of the round in the embedded data', async () => {
    render(
      <ThemeProvider>
        <ReportPreview roundData={{ ...roundData, checklistName: '標準' }} categories={categories} onBack={() => {}} />
      </ThemeProvider>,
    );
    await screen.findByRole('button', { name: 'Word出力' });

    expect(vi.mocked(embedRoundExport).mock.calls[0][1].checklistName).toBe('標準');
  });

  it('builds the file only once while the preview stays open', async () => {
    const { rerender } = render(
      <ThemeProvider>
        <ReportPreview roundData={roundData} categories={categories} onBack={() => {}} />
      </ThemeProvider>,
    );
    await screen.findByRole('button', { name: 'Word出力' });

    rerender(
      <ThemeProvider>
        <ReportPreview roundData={roundData} categories={categories} onBack={() => {}} />
      </ThemeProvider>,
    );

    expect(buildDocxBlob).toHaveBeenCalledTimes(1);
  });

  it('explains the failure and keeps both actions unavailable when the file cannot be built', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(buildDocxBlob).mockRejectedValueOnce(new Error('画像が大きすぎます'));
    stubShare();
    renderPreview();

    expect(await screen.findByText(/報告書ファイルを作成できませんでした（画像が大きすぎます）/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '作成できません' })).toBeDisabled();
    expect(navigator.share).not.toHaveBeenCalled();
  });

  it('shows a non-Error rejection as text in the failure message', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(embedRoundExport).mockRejectedValueOnce('zip broken');
    renderPreview();

    expect(await screen.findByText(/報告書ファイルを作成できませんでした（zip broken）/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '作成できません' })).toBeDisabled();
  });
});

describe('ReportPreview sharing and downloading', () => {
  it('counts a completed share as an export', async () => {
    const share = stubShare();
    const user = renderPreview();

    await user.click(await screen.findByRole('button', { name: '共有' }));

    expect(share.mock.calls[0][0].title).toBe('感染対策ラウンド報告書');
    await waitFor(() => expect(trackEvent).toHaveBeenCalledWith('round_export', { method: 'share' }));
    expect(screen.getByRole('button', { name: '共有' })).toBeEnabled();
  });

  it('disables the share button while the share sheet is open', async () => {
    const share = stubShare();
    share.mockImplementation(() => new Promise(() => {}));
    const user = renderPreview();
    const button = await screen.findByRole('button', { name: '共有' });

    await user.click(button);
    await user.click(button);

    expect(button).toBeDisabled();
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('treats a cancelled share sheet as neither an export nor a failure', async () => {
    const share = stubShare();
    share.mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'));
    const user = renderPreview();

    await user.click(await screen.findByRole('button', { name: '共有' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '共有' })).toBeEnabled());
    expect(trackEvent).not.toHaveBeenCalled();
    expect(screen.queryByText(/共有できませんでした/)).not.toBeInTheDocument();
  });

  it('switches to download with an explanation when sharing fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const share = stubShare();
    share.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    const user = renderPreview();

    await user.click(await screen.findByRole('button', { name: '共有' }));

    expect(await screen.findByText(/共有できませんでした。/)).toBeInTheDocument();
    expect(trackEvent).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Word出力' }));
    expect(saveAs).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('round_export', { method: 'download' });
  });

  it('counts a download as an export', async () => {
    const user = renderPreview();

    await user.click(await screen.findByRole('button', { name: 'Word出力' }));

    const [file] = vi.mocked(saveAs).mock.calls[0];
    expect(file).toBeInstanceOf(File);
    expect(trackEvent).toHaveBeenCalledWith('round_export', { method: 'download' });
  });
});
