import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReportPreview from '../../components/ReportPreview';
import { trackEvent } from '../../analytics';
import { ThemeProvider } from '../../ThemeContext';
import type { ChecklistCategory, RoundData } from '../../types';

vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));
// The tests are about the feedback link, so skip the real Word build
vi.mock('../../docx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../docx')>();
  return { ...actual, buildDocxBlob: vi.fn(() => Promise.resolve(new Blob(['docx']))) };
});
vi.mock('../../roundExportDocx', () => ({ embedRoundExport: vi.fn((blob: Blob) => Promise.resolve(blob)) }));

const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSeW5eVVamKxZBNqy__NQAjRdaMeZBo8Y7Os4CpX5KhKIQsugA/viewform';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const LABEL = '使ってみた感想を送る';

const categories: ChecklistCategory[] = [
  { category: '手指衛生', items: [{ id: 'h1', category: '手指衛生', description: '手指消毒剤が配置されている' }] },
];

const roundData: RoundData = {
  inspectorName: '田中 一郎',
  wardName: '3階東病棟',
  startTime: '2026/10/06 07:00',
  checklistResults: [{ itemId: 'h1', rating: 'C', photos: [] }],
  generalPhotos: [],
  overallEvaluation: '手指消毒剤の補充が遅れている',
};

function renderPreview(isSample?: boolean) {
  render(
    <ThemeProvider>
      <ReportPreview roundData={roundData} categories={categories} isSample={isSample} onBack={() => {}} />
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

const feedbackLink = () => screen.getByRole('link', { name: LABEL });

// jsdom cannot open a new tab, so stop the browser default while React handlers still run
const preventNavigation = (e: MouseEvent) => {
  if (e.target instanceof Element && e.target.closest('a')) e.preventDefault();
};

beforeEach(() => {
  document.addEventListener('click', preventNavigation);
  Object.defineProperty(navigator, 'userAgent', { value: IPHONE, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
});

afterEach(() => {
  document.removeEventListener('click', preventNavigation);
  // Remove the own properties so jsdom's navigator is back to its defaults
  for (const key of ['share', 'canShare', 'userAgent', 'maxTouchPoints']) Reflect.deleteProperty(navigator, key);
  vi.clearAllMocks();
});

describe('ReportPreview feedback link', () => {
  it('is not shown before the report is exported', async () => {
    renderPreview();

    expect(await screen.findByRole('button', { name: 'Word出力' })).toBeEnabled();
    expect(screen.queryByText(LABEL)).not.toBeInTheDocument();
  });

  it('appears after a download and opens the pre-filled form in a new tab', async () => {
    const user = renderPreview();

    await user.click(await screen.findByRole('button', { name: 'Word出力' }));

    const link = feedbackLink();
    expect(link).toHaveAttribute(
      'href',
      `${FORM}?usp=pp_url&entry.999783493=${encodeURIComponent(__APP_VERSION__)}&entry.2044868744=iPhone`,
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('appears after a completed share', async () => {
    stubShare();
    const user = renderPreview();

    await user.click(await screen.findByRole('button', { name: '共有' }));

    expect(await screen.findByRole('link', { name: LABEL })).toBeInTheDocument();
  });

  it('stays hidden when the share sheet is cancelled', async () => {
    const share = stubShare();
    share.mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'));
    const user = renderPreview();

    await user.click(await screen.findByRole('button', { name: '共有' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '共有' })).toBeEnabled());
    expect(screen.queryByText(LABEL)).not.toBeInTheDocument();
  });

  it('stays hidden when sharing fails until the report is downloaded instead', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const share = stubShare();
    share.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'));
    const user = renderPreview();

    await user.click(await screen.findByRole('button', { name: '共有' }));
    await user.click(await screen.findByRole('button', { name: 'Word出力' }));

    expect(feedbackLink()).toBeInTheDocument();
    vi.mocked(console.error).mockRestore();
  });

  it('also appears for the sample', async () => {
    const user = renderPreview(true);

    await user.click(await screen.findByRole('button', { name: 'Word出力' }));

    expect(feedbackLink()).toBeInTheDocument();
  });

  it('records the open from the report screen', async () => {
    const user = renderPreview();
    await user.click(await screen.findByRole('button', { name: 'Word出力' }));
    vi.mocked(trackEvent).mockClear();

    await user.click(feedbackLink());

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('feedback_open', { from: 'report' });
  });

  it('carries only the version and the device, none of the round data', async () => {
    const user = renderPreview();
    await user.click(await screen.findByRole('button', { name: 'Word出力' }));

    const href = feedbackLink().getAttribute('href') ?? '';
    const params = new URL(href).searchParams;
    expect([...params.keys()]).toEqual(['usp', 'entry.999783493', 'entry.2044868744']);
    expect(decodeURIComponent(href)).not.toMatch(/田中|3階東病棟|手指|2026\/10\/06/);
  });
});
