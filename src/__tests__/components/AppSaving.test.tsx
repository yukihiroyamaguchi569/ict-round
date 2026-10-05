import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import {
  ACTIVE_ID_KEY,
  ROUNDS_KEY,
  START_TIME,
  storedRounds,
  savedRound,
  renderApp,
  startRound,
  progress,
  tab,
  homeButton,
  saveButton,
  leaveDialogHeading,
  isStartScreen,
  reportRound,
  rateFirstItem,
  failSavingRounds,
  registerAppTestHooks,
} from './appTestHelpers';

// See appStubs.tsx for why these screens are stubbed.
vi.mock('../../components/PhotoForm', () => import('./appStubs').then((m) => ({ default: m.PhotoFormStub })));
vi.mock('../../components/ReportPreview', () => import('./appStubs').then((m) => ({ default: m.ReportPreviewStub })));
vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));

registerAppTestHooks();

describe('App saving a round', () => {
  it('stores the round with a generated id, a title, the save time and the checklist id', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    const { user } = renderApp();
    await startRound(user);
    await rateFirstItem(user);
    await user.click(saveButton());

    expect(storedRounds()).toEqual([
      {
        id: '00000000-0000-4000-8000-000000000001',
        title: `山田 花子 / 3階東病棟（${START_TIME}）`,
        savedAt: '2026-10-05T22:00:00.000Z',
        version: 1,
        checklistId: 'ward',
        roundData: {
          inspectorName: '山田 花子',
          wardName: '3階東病棟',
          startTime: START_TIME,
          checklistResults: [
            { itemId: 'h1', rating: 'A', photos: [] },
            { itemId: 'h2', rating: null, photos: [] },
          ],
          generalPhotos: [],
          overallEvaluation: '',
          checklistName: '病棟用',
        },
      },
    ]);
    expect(screen.getByText('保存済み')).toBeInTheDocument();
  });

  it('leaves the ward out of the title when it is empty', async () => {
    const { user } = renderApp();
    await startRound(user, '山田 花子', '');
    await user.click(saveButton());

    expect(storedRounds()[0].title).toBe(`山田 花子（${START_TIME}）`);
  });

  it('saving again updates the same entry instead of adding one', async () => {
    const uuid = vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    const { user } = renderApp();
    await startRound(user);
    await user.click(saveButton());
    vi.setSystemTime(new Date('2026-10-05T22:30:00Z'));
    await rateFirstItem(user);
    await user.click(saveButton());

    expect(uuid).toHaveBeenCalledTimes(1);
    const rounds = storedRounds();
    expect(rounds).toHaveLength(1);
    expect(rounds[0].savedAt).toBe('2026-10-05T22:30:00.000Z');
    expect(rounds[0].roundData.checklistResults[0].rating).toBe('A');
  });

  it.each([
    ['QuotaExceededError', /保存容量の上限に達したため保存できませんでした/],
    ['NS_ERROR_DOM_QUOTA_REACHED', /保存容量の上限に達したため保存できませんでした/],
    ['SecurityError', /^保存に失敗しました。しばらくしてからもう一度お試しください。$/],
  ])('a %s while saving shows the matching message and saves nothing', async (name, message) => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    failSavingRounds(new DOMException('failed', name));
    const { user } = renderApp();
    await startRound(user);
    await rateFirstItem(user);
    await user.click(saveButton());

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toMatch(message);
    expect(screen.queryByText('保存済み')).not.toBeInTheDocument();
    expect(storedRounds()).toEqual([]);
    // Still unsaved, so leaving asks first.
    await user.click(homeButton());
    expect(leaveDialogHeading()).toBeInTheDocument();
  });

  it('a non-DOMException error while saving shows the generic message', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    failSavingRounds(new Error('boom'));
    const { user } = renderApp();
    await startRound(user);
    await user.click(saveButton());

    expect(alertSpy).toHaveBeenCalledWith('保存に失敗しました。しばらくしてからもう一度お試しください。');
  });
});

describe('App saved rounds', () => {
  it('opens the saved round list from the start screen and goes back', async () => {
    localStorage.setItem(ROUNDS_KEY, JSON.stringify([savedRound()]));
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /^保存済みラウンドを開く\s*1$/ }));

    expect(screen.getByRole('heading', { name: '保存済みラウンド' })).toBeInTheDocument();
    expect(screen.getByText('佐藤 / 外来（2026/10/01 09:00）')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '戻る' }));
    expect(isStartScreen()).toBe(true);
  });

  it('opening a saved round restores it, switches the checklist and counts as saved', async () => {
    const uuid = vi.spyOn(crypto, 'randomUUID');
    localStorage.setItem(ROUNDS_KEY, JSON.stringify([savedRound()]));
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /保存済みラウンドを開く/ }));
    await user.click(screen.getByRole('button', { name: '開く' }));

    expect(localStorage.getItem(ACTIVE_ID_KEY)).toBe('clinic');
    expect(screen.getByText('参加者: 佐藤・外来')).toBeInTheDocument();
    expect(progress()).toHaveTextContent('1/3');
    expect(tab('チェック')).toHaveAttribute('aria-current', 'page');
    expect(await reportRound(user)).toEqual(savedRound().roundData);

    // Saving updates the opened entry.
    await rateFirstItem(user, 'A');
    await user.click(saveButton());
    expect(uuid).not.toHaveBeenCalled();
    const rounds = storedRounds();
    expect(rounds).toHaveLength(1);
    expect(rounds[0].id).toBe('saved-1');
    expect(rounds[0].checklistId).toBe('clinic');
  });

  it('opening a saved round whose checklist is gone shows an alert and stays on the list', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    localStorage.setItem(ROUNDS_KEY, JSON.stringify([savedRound({ checklistId: 'deleted' })]));
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /保存済みラウンドを開く/ }));
    await user.click(screen.getByRole('button', { name: '開く' }));

    expect(alertSpy).toHaveBeenCalledWith('保存時に使用したチェックリストが見つかりません。');
    expect(screen.getByRole('heading', { name: '保存済みラウンド' })).toBeInTheDocument();
    expect(localStorage.getItem(ACTIVE_ID_KEY)).toBe('ward');
  });

  it('deleting a saved round removes it from storage and the list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.setItem(
      ROUNDS_KEY,
      JSON.stringify([savedRound(), savedRound({ id: 'saved-2', title: '二件目', savedAt: '2026-09-01T00:00:00.000Z' })]),
    );
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /^保存済みラウンドを開く\s*2$/ }));
    const card = screen.getByText('二件目').closest('.card');
    if (!(card instanceof HTMLElement)) throw new Error('card not found');
    await user.click(within(card).getByRole('button', { name: '削除' }));

    expect(storedRounds().map((r) => r.id)).toEqual(['saved-1']);
    expect(screen.queryByText('二件目')).not.toBeInTheDocument();
    expect(screen.getByText('1件')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '戻る' }));
    expect(screen.getByRole('button', { name: /^保存済みラウンドを開く\s*1$/ })).toBeInTheDocument();
  });
});
