import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import {
  ROUNDS_KEY,
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

describe('App round editing', () => {
  it('a rating updates the progress and the round data', async () => {
    const { user } = renderApp();
    await startRound(user);
    await rateFirstItem(user, 'B');

    expect(progress()).toHaveTextContent('1/2');
    const round = await reportRound(user);
    expect(round.checklistResults).toEqual([
      { itemId: 'h1', rating: 'B', photos: [] },
      { itemId: 'h2', rating: null, photos: [] },
    ]);
  });

  it('the overall evaluation is kept in the round data', async () => {
    const { user } = renderApp();
    await startRound(user);
    await user.click(tab('総評'));
    await user.type(screen.getByRole('textbox'), '良好でした');

    expect((await reportRound(user)).overallEvaluation).toBe('良好でした');
  });

  it('coming back from the report keeps the current tab', async () => {
    const { user } = renderApp();
    await startRound(user);
    await user.click(tab('総評'));
    await reportRound(user);

    expect(tab('総評')).toHaveAttribute('aria-current', 'page');
  });

  it('the report receives the categories of the active checklist', async () => {
    const { user } = renderApp();
    await startRound(user);
    await user.click(screen.getByRole('button', { name: 'レポート' }));

    expect(screen.getByTestId('report-categories')).toHaveTextContent('手指衛生');
  });

  it('adds a general photo and returns to the photos tab', async () => {
    const { user } = renderApp();
    await startRound(user);
    await user.click(tab('写真'));
    await user.click(screen.getByRole('button', { name: '写真を追加' }));

    expect(screen.getByTestId('photo-form')).toHaveTextContent('general:1');
    await user.click(screen.getByRole('button', { name: 'stub-add' }));

    expect(tab('写真')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('汎用写真')).toBeInTheDocument();
    expect(screen.getByText('汚れあり')).toBeInTheDocument();
    const round = await reportRound(user);
    expect(round.generalPhotos).toEqual([
      { id: 'p-new', dataUrl: 'data:image/jpeg;base64,AA', comment: '汚れあり', timestamp: '07:05' },
    ]);
    expect(round.checklistResults.every((r) => r.photos.length === 0)).toBe(true);
  });

  it('cancelling the add-photo screen returns to the same tab without adding', async () => {
    const { user } = renderApp();
    await startRound(user);
    await user.click(tab('写真'));
    await user.click(screen.getByRole('button', { name: '写真を追加' }));
    await user.click(screen.getByRole('button', { name: 'stub-cancel' }));

    expect(tab('写真')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('写真はまだありません')).toBeInTheDocument();
  });

  it('deletes a general photo', async () => {
    const { user } = renderApp();
    await startRound(user);
    await user.click(tab('写真'));
    await user.click(screen.getByRole('button', { name: '写真を追加' }));
    await user.click(screen.getByRole('button', { name: 'stub-add' }));
    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(screen.getByText('写真はまだありません')).toBeInTheDocument();
    expect((await reportRound(user)).generalPhotos).toEqual([]);
  });

  it('deletes a photo linked to a checklist item', async () => {
    localStorage.setItem(ROUNDS_KEY, JSON.stringify([savedRound()]));
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /保存済みラウンドを開く/ }));
    await user.click(screen.getByRole('button', { name: '開く' }));
    await user.click(tab('写真'));

    expect(screen.getByText('床の汚れ')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除' }));
    expect(screen.getByText('写真はまだありません')).toBeInTheDocument();
    const round = await reportRound(user);
    expect(round.checklistResults[0]).toEqual({ itemId: 'e1', rating: 'B', photos: [] });
  });

  it('editing the participant name in the header updates the round and the next start screen', async () => {
    const { user } = renderApp();
    await startRound(user);
    await user.click(screen.getByRole('button', { name: /参加者: 山田 花子/ }));
    const input = screen.getByPlaceholderText('参加者名');
    await user.clear(input);
    await user.type(input, '  鈴木 一郎  {Enter}');

    expect(screen.getByText('参加者: 鈴木 一郎・3階東病棟')).toBeInTheDocument();
    expect((await reportRound(user)).inspectorName).toBe('鈴木 一郎');
    await user.click(homeButton());
    await user.click(screen.getByRole('button', { name: '保存せずに戻る' }));
    expect(screen.getByPlaceholderText('例: 山田 花子')).toHaveValue('鈴木 一郎');
  });
});

describe('App leaving a round', () => {
  it('goes straight to the start screen when nothing changed', async () => {
    const { user } = renderApp();
    await startRound(user);
    await user.click(homeButton());

    expect(leaveDialogHeading()).not.toBeInTheDocument();
    expect(isStartScreen()).toBe(true);
  });

  it('asks before leaving with unsaved changes, and cancel keeps the round', async () => {
    const { user } = renderApp();
    await startRound(user);
    await rateFirstItem(user);
    await user.click(homeButton());

    expect(leaveDialogHeading()).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(leaveDialogHeading()).not.toBeInTheDocument();
    expect(progress()).toHaveTextContent('1/2');
  });

  it('leaving without saving discards the changes', async () => {
    const { user } = renderApp();
    await startRound(user);
    await rateFirstItem(user);
    await user.click(homeButton());
    await user.click(screen.getByRole('button', { name: '保存せずに戻る' }));

    expect(isStartScreen()).toBe(true);
    expect(leaveDialogHeading()).not.toBeInTheDocument();
    expect(storedRounds()).toEqual([]);
    expect(screen.getByRole('button', { name: '保存済みラウンドを開く' })).toBeInTheDocument();
  });

  it('save and leave stores the round and returns to the start screen', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001');
    const { user } = renderApp();
    await startRound(user);
    await rateFirstItem(user);
    await user.click(homeButton());
    await user.click(screen.getByRole('button', { name: '保存して戻る' }));

    expect(isStartScreen()).toBe(true);
    expect(storedRounds()).toHaveLength(1);
    expect(storedRounds()[0].roundData.checklistResults[0].rating).toBe('A');
    expect(screen.getByRole('button', { name: /^保存済みラウンドを開く\s*1$/ })).toBeInTheDocument();
  });

  it('stays on the dialog when save and leave fails', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    failSavingRounds(new DOMException('full', 'QuotaExceededError'));
    const { user } = renderApp();
    await startRound(user);
    await rateFirstItem(user);
    await user.click(homeButton());
    await user.click(screen.getByRole('button', { name: '保存して戻る' }));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(leaveDialogHeading()).toBeInTheDocument();
    expect(isStartScreen()).toBe(false);
    expect(storedRounds()).toEqual([]);
  });

  it('after saving, leaving does not ask until something changes again', async () => {
    const { user } = renderApp();
    await startRound(user);
    await rateFirstItem(user);
    await user.click(saveButton());
    await user.click(homeButton());
    expect(leaveDialogHeading()).not.toBeInTheDocument();
    expect(isStartScreen()).toBe(true);

    await user.click(screen.getByRole('button', { name: /保存済みラウンドを開く/ }));
    await user.click(screen.getByRole('button', { name: '開く' }));
    await rateFirstItem(user, 'C');
    await user.click(homeButton());
    expect(leaveDialogHeading()).toBeInTheDocument();
  });
});
