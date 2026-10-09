import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { trackEvent } from '../../analytics';
import type { RoundData } from '../../types';
import {
  ROUNDS_KEY,
  storedRounds,
  savedRound,
  renderApp,
  startRound,
  homeButton,
  leaveDialogHeading,
  isStartScreen,
  rateFirstItem,
  stubFetch,
  registerAppTestHooks,
  type User,
} from './appTestHelpers';

// See appStubs.tsx for why these screens are stubbed.
vi.mock('../../components/PhotoForm', () => import('./appStubs').then((m) => ({ default: m.PhotoFormStub })));
vi.mock('../../components/ReportPreview', () => import('./appStubs').then((m) => ({ default: m.ReportPreviewStub })));
vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));

registerAppTestHooks();
beforeEach(() => vi.mocked(trackEvent).mockClear());

const SAMPLE_BANNER = 'サンプルです（保存されません）';

function sampleButton() {
  return screen.getByRole('button', { name: /サンプルで試す/ });
}

/** Starts the sample and waits for the round screen (photo loading is asynchronous). */
async function startSample(user: User) {
  await user.click(sampleButton());
  await screen.findByText(SAMPLE_BANNER);
}

/** Opens the report and reads what App passed to it. */
async function openReport(user: User) {
  await user.click(screen.getByRole('button', { name: 'レポート' }));
  return {
    roundData: JSON.parse(screen.getByTestId('report-round').textContent ?? '') as RoundData,
    categories: screen.getByTestId('report-categories').textContent,
    isSample: screen.getByTestId('report-sample').textContent,
  };
}

function jpegResponse() {
  return Promise.resolve(new Response(new Uint8Array([0xff, 0xd8, 0xff]), { headers: { 'Content-Type': 'image/jpeg' } }));
}

describe('App sample round: start screen', () => {
  it('offers the sample prominently next to the start button while there are no saved rounds', () => {
    renderApp();
    expect(sampleButton()).toHaveAccessibleName(/入力済みの例で報告書の出力まで試せます/);
  });

  it('keeps the sample as a quiet link once a round has been saved', () => {
    localStorage.setItem(ROUNDS_KEY, JSON.stringify([savedRound()]));
    renderApp();
    expect(sampleButton()).toHaveAccessibleName('サンプルで試す');
  });
});

describe('App sample round: in progress', () => {
  it('starts the sample on the built-in checklist, rated and evaluated, with the sample banner and no save button', async () => {
    const { user } = renderApp();
    await startSample(user);

    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(screen.getByText(/参加者: サンプル 太郎・【サンプル】3階東病棟/)).toBeInTheDocument();
    const report = await openReport(user);
    // The library seeded for these tests is '病棟用'; the sample ignores it.
    expect(report.categories).toContain('汚物室・トイレ');
    expect(report.roundData.checklistName).toBe('標準チェックリスト');
    expect(report.roundData.checklistResults.every((r) => r.rating !== null)).toBe(true);
    expect(report.roundData.overallEvaluation).not.toBe('');
    expect(report.isSample).toBe('true');
  });

  it('still starts, without photos, when the sample photos cannot be fetched', async () => {
    // registerAppTestHooks makes every fetch fail
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { user } = renderApp();
    await startSample(user);

    const { roundData } = await openReport(user);
    expect(roundData.generalPhotos).toEqual([]);
    expect(roundData.checklistResults.every((r) => r.photos.length === 0)).toBe(true);
  });

  it('includes the sample photos when they can be fetched and decoded', async () => {
    const fetchMock = stubFetch(jpegResponse);
    vi.stubGlobal('createImageBitmap', vi.fn(() => Promise.resolve({ width: 640, height: 480, close: () => {} })));
    const { user } = renderApp();
    await startSample(user);

    const { roundData } = await openReport(user);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(
      expect.arrayContaining(['/sample/item-1.jpg', '/sample/item-2.jpg', '/sample/general-1.jpg'])
    );
    expect(roundData.generalPhotos).toHaveLength(1);
    expect(roundData.checklistResults.find((r) => r.itemId === 'hand-hygiene-2')?.photos).toHaveLength(1);
    expect(roundData.checklistResults.find((r) => r.itemId === 'linen-2')?.photos).toHaveLength(1);
  });

  it('goes home without the leave dialog after changes, and nothing is saved', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const { user } = renderApp();
    await startSample(user);
    await rateFirstItem(user, 'C');
    await user.click(homeButton());

    expect(leaveDialogHeading()).not.toBeInTheDocument();
    expect(isStartScreen()).toBe(true);
    expect(storedRounds()).toEqual([]);
    expect(setItem.mock.calls.filter(([key]) => key === ROUNDS_KEY)).toEqual([]);
  });

  it('leaves the saved rounds as they were', async () => {
    localStorage.setItem(ROUNDS_KEY, JSON.stringify([savedRound()]));
    const { user } = renderApp();
    await startSample(user);
    await user.click(homeButton());

    expect(storedRounds()).toEqual([savedRound()]);
    expect(screen.getByRole('button', { name: /保存済みラウンドを開く/ })).toHaveTextContent('1');
  });

  it('does not carry the sample participant, or a name typed in the sample, to the next start', async () => {
    const { user } = renderApp();
    await startRound(user, '山田 花子');
    await user.click(homeButton());
    await startSample(user);
    await user.click(screen.getByText(/参加者: サンプル 太郎/));
    const nameInput = screen.getByPlaceholderText('参加者名');
    await user.clear(nameInput);
    await user.type(nameInput, '別の名前{Enter}');
    await user.click(homeButton());

    expect(screen.getByPlaceholderText('例: 山田 花子')).toHaveValue('山田 花子');
  });

  it('a normal round after the sample is saved and asks before leaving as usual', async () => {
    const { user } = renderApp();
    await startSample(user);
    await user.click(homeButton());
    await startRound(user);

    expect(screen.queryByText(SAMPLE_BANNER)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
    await rateFirstItem(user);
    await user.click(homeButton());
    expect(leaveDialogHeading()).toBeInTheDocument();
  });

  it('a normal round started while the sample photos load is not replaced by the sample', async () => {
    const pending: (() => void)[] = [];
    stubFetch(() => new Promise((resolve) => pending.push(() => resolve(jpegResponse()))));
    const { user } = renderApp();
    await user.click(sampleButton());
    expect(screen.getByRole('button', { name: /準備中/ })).toBeDisabled();
    await startRound(user, '山田 花子');
    expect(pending).toHaveLength(3);
    pending.forEach((release) => release());
    // Let the sample load finish (reading and encoding the photos)
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    expect(screen.queryByText(SAMPLE_BANNER)).not.toBeInTheDocument();
    expect(screen.getByText(/参加者: 山田 花子/)).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('round_start', { sample: false });
    expect(trackEvent).not.toHaveBeenCalledWith('round_start', { sample: true });
  });
});

describe('App sample round: leaving the start screen while it loads', () => {
  it('stays on the saved rounds list when the sample finishes loading after the user went there', async () => {
    const pending: (() => void)[] = [];
    stubFetch(() => new Promise((resolve) => pending.push(() => resolve(jpegResponse()))));
    const { user } = renderApp();
    await user.click(sampleButton());
    await user.click(screen.getByRole('button', { name: /保存済みラウンドを開く/ }));
    pending.forEach((release) => release());
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));

    expect(screen.getByText('保存済みラウンドはありません')).toBeInTheDocument();
    expect(screen.queryByText(SAMPLE_BANNER)).not.toBeInTheDocument();
    expect(trackEvent).not.toHaveBeenCalledWith('round_start', expect.anything());
  });
});

describe('App sample round: analytics', () => {
  it('sends round_start with sample true for the sample and false for a normal round, without any input data', async () => {
    const { user } = renderApp();
    await startSample(user);
    expect(trackEvent).toHaveBeenLastCalledWith('round_start', { sample: true });

    await user.click(homeButton());
    await startRound(user);
    expect(trackEvent).toHaveBeenLastCalledWith('round_start', { sample: false });
    expect(vi.mocked(trackEvent).mock.calls.filter(([name]) => name === 'round_start')).toHaveLength(2);
  });

  it('does not send round_start when a saved round is reopened', async () => {
    localStorage.setItem(ROUNDS_KEY, JSON.stringify([savedRound()]));
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /保存済みラウンドを開く/ }));
    await user.click(screen.getByRole('button', { name: '開く' }));
    expect(screen.getByText(/参加者: 佐藤/)).toBeInTheDocument();

    expect(trackEvent).not.toHaveBeenCalledWith('round_start', expect.anything());
  });
});
