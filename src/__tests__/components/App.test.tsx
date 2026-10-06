import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import {
  LIBRARY_KEY,
  ACTIVE_ID_KEY,
  START_TIME,
  seedLibrary,
  storedRounds,
  storedLibraryIds,
  renderApp,
  startRound,
  progress,
  tab,
  homeButton,
  reportRound,
  rateFirstItem,
  registerAppTestHooks,
} from './appTestHelpers';

// See appStubs.tsx for why these screens are stubbed.
vi.mock('../../components/PhotoForm', () => import('./appStubs').then((m) => ({ default: m.PhotoFormStub })));
vi.mock('../../components/ReportPreview', () => import('./appStubs').then((m) => ({ default: m.ReportPreviewStub })));
vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));

registerAppTestHooks();

describe('App checklist library', () => {
  it('seeds and activates the standard checklist on first run', async () => {
    localStorage.removeItem(LIBRARY_KEY);
    localStorage.removeItem(ACTIVE_ID_KEY);
    const { user } = renderApp();

    expect(screen.getByText('標準チェックリスト')).toBeInTheDocument();
    expect(storedLibraryIds()).toEqual(['default']);
    expect(localStorage.getItem(ACTIVE_ID_KEY)).toBe('default');

    await startRound(user);
    expect((await reportRound(user)).checklistName).toBe('標準チェックリスト');
  });

  it('falls back to the first checklist when the stored active id is unknown, without rewriting it', async () => {
    seedLibrary('missing');
    const { user } = renderApp();
    await startRound(user);

    expect(progress()).toHaveTextContent('0/2');
    expect(localStorage.getItem(ACTIVE_ID_KEY)).toBe('missing');
  });

  it('selecting a checklist persists it and the next round uses it', async () => {
    const { user } = renderApp();
    await user.click(screen.getByText('外来用'));
    expect(localStorage.getItem(ACTIVE_ID_KEY)).toBe('clinic');

    await startRound(user);
    expect(progress()).toHaveTextContent('0/3');
    expect((await reportRound(user)).checklistName).toBe('外来用');
  });

  it('deleting the active checklist falls back to the first remaining one', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderApp();
    await user.click(screen.getAllByRole('button', { name: '削除' })[0]);

    expect(screen.queryByText('病棟用')).not.toBeInTheDocument();
    expect(storedLibraryIds()).toEqual(['clinic']);
    expect(localStorage.getItem(ACTIVE_ID_KEY)).toBe('clinic');
    await startRound(user);
    expect(progress()).toHaveTextContent('0/3');
  });

  it('deleting another checklist keeps the active one', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderApp();
    await user.click(screen.getAllByRole('button', { name: '削除' })[1]);

    expect(storedLibraryIds()).toEqual(['ward']);
    expect(localStorage.getItem(ACTIVE_ID_KEY)).toBe('ward');
    await startRound(user);
    expect(progress()).toHaveTextContent('0/2');
  });

  it('does not delete a checklist when the confirmation is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderApp();
    await user.click(screen.getAllByRole('button', { name: '削除' })[0]);

    expect(storedLibraryIds()).toEqual(['ward', 'clinic']);
    expect(screen.getByText('病棟用')).toBeInTheDocument();
  });

  it('an imported checklist is added to the library, persisted and selected', async () => {
    const { user, container } = renderApp();
    await user.click(screen.getByRole('button', { name: '新しいチェックリストを追加する' }));
    const fileInput = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!fileInput) throw new Error('file input not found');
    const csv = ['category,description', '廃棄物,分別されている', '廃棄物,蓋が閉まっている'].join('\n');
    await user.upload(fileInput, new File([csv], '廃棄物.csv', { type: 'text/csv' }));
    await screen.findByText('廃棄物（2項目）');
    await user.click(screen.getByRole('button', { name: '保存して適用' }));

    const ids = storedLibraryIds();
    expect(ids).toHaveLength(3);
    expect(ids.slice(0, 2)).toEqual(['ward', 'clinic']);
    expect(localStorage.getItem(ACTIVE_ID_KEY)).toBe(ids[2]);
    expect(screen.getByText('廃棄物')).toBeInTheDocument();

    await startRound(user);
    expect((await reportRound(user)).checklistName).toBe('廃棄物');
  });
});

describe('App round start', () => {
  it('initializes the round from the active checklist and opens the checklist tab', async () => {
    const { user } = renderApp();
    await startRound(user);

    expect(screen.getByText('参加者: 山田 花子・3階東病棟')).toBeInTheDocument();
    expect(progress()).toHaveTextContent('0/2');
    expect(tab('チェック')).toHaveAttribute('aria-current', 'page');
    expect(await reportRound(user)).toEqual({
      inspectorName: '山田 花子',
      wardName: '3階東病棟',
      startTime: START_TIME,
      checklistResults: [
        { itemId: 'h1', rating: null, photos: [] },
        { itemId: 'h2', rating: null, photos: [] },
      ],
      generalPhotos: [],
      overallEvaluation: '',
      checklistName: '病棟用',
    });
  });

  it('a new round starts clean even after a previous round was edited', async () => {
    const { user } = renderApp();
    await startRound(user);
    await rateFirstItem(user);
    await user.click(tab('総評'));
    await user.type(screen.getByRole('textbox'), '前回の総評');
    await user.click(homeButton());
    await user.click(screen.getByRole('button', { name: '保存せずに戻る' }));

    await user.click(screen.getByRole('button', { name: 'ラウンド開始' }));
    expect(tab('チェック')).toHaveAttribute('aria-current', 'page');
    const round = await reportRound(user);
    expect(round.checklistResults.every((r) => r.rating === null)).toBe(true);
    expect(round.overallEvaluation).toBe('');
    // Nothing was saved, so a later save is a new entry, not an update.
    expect(storedRounds()).toEqual([]);
  });

  it('carries the participant name over to the next start screen', async () => {
    const { user } = renderApp();
    await startRound(user);
    await user.click(homeButton());

    expect(screen.getByPlaceholderText('例: 山田 花子')).toHaveValue('山田 花子');
    expect(screen.getByPlaceholderText('例: 3階東病棟')).toHaveValue('');
  });
});
