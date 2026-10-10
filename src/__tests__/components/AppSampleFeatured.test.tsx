import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, screen } from '@testing-library/react';
import { useRound } from '../../useRound';
import {
  ROUNDS_KEY,
  savedRound,
  renderApp,
  startRound,
  homeButton,
  saveButton,
  storedRounds,
  failSavingRounds,
  registerAppTestHooks,
  type User,
} from './appTestHelpers';

// Unlike the other App tests the report screen is real, so exporting runs useReportFile;
// only the Word build and the file save are replaced.
vi.mock('../../components/PhotoForm', () => import('./appStubs').then((m) => ({ default: m.PhotoFormStub })));
vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('file-saver', () => ({ saveAs: vi.fn() }));
vi.mock('../../docx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../docx')>();
  return { ...actual, buildDocxBlob: vi.fn(() => Promise.resolve(new Blob(['docx']))) };
});
vi.mock('../../roundExportDocx', () => ({ embedRoundExport: vi.fn((blob: Blob) => Promise.resolve(blob)) }));

registerAppTestHooks();

const ROUND_USED_KEY = 'icn-round:round-used';
const FEATURED = /入力済みの例で報告書の出力まで試せます/;

/** The sample button's accessible name tells the featured card from the quiet link. */
function expectFeatured(featured: boolean) {
  const button = screen.getByRole('button', { name: /サンプルデータで試す/ });
  if (featured) expect(button).toHaveAccessibleName(FEATURED);
  else expect(button).toHaveAccessibleName('サンプルデータで試す');
}

/** Opens the report, downloads the Word file, and goes back to the start screen. */
async function exportAndGoHome(user: User) {
  await user.click(screen.getByRole('button', { name: 'レポート' }));
  await user.click(await screen.findByRole('button', { name: 'Word出力' }));
  await user.click(screen.getByRole('button', { name: '戻る' }));
  await user.click(homeButton());
}

describe('App start screen: featuring the sample', () => {
  it('features the sample on first use', () => {
    renderApp();
    expectFeatured(true);
  });

  it('moves the sample to the quiet links after a normal round is exported', async () => {
    const { user } = renderApp();
    await startRound(user);
    await exportAndGoHome(user);

    expectFeatured(false);
    expect(localStorage.getItem(ROUND_USED_KEY)).toBe('1');
    // Exporting does not save the round.
    expect(storedRounds()).toEqual([]);
  });

  it('moves the sample to the quiet links after a normal round is saved, and keeps it there after the round is deleted', async () => {
    const { user } = renderApp();
    await startRound(user);
    await user.click(saveButton());
    await user.click(homeButton());
    expectFeatured(false);

    await user.click(screen.getByRole('button', { name: /保存済みラウンドを開く/ }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: '削除' }));
    expect(storedRounds()).toEqual([]);
    await user.click(screen.getByRole('button', { name: /戻る/ }));
    expectFeatured(false);
  });

  it('keeps featuring the sample after the sample is exported', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: /サンプルデータで試す/ }));
    await screen.findByText('サンプルです（保存されません）');
    await exportAndGoHome(user);

    expectFeatured(true);
    expect(localStorage.getItem(ROUND_USED_KEY)).toBeNull();
  });

  it('keeps featuring the sample when saving a normal round fails', async () => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    failSavingRounds(new DOMException('full', 'QuotaExceededError'));
    const { user } = renderApp();
    await startRound(user);
    await user.click(saveButton());
    await user.click(homeButton());

    expectFeatured(true);
    expect(localStorage.getItem(ROUND_USED_KEY)).toBeNull();
  });

  it('does not feature the sample while a saved round exists, even without the mark', () => {
    localStorage.setItem(ROUNDS_KEY, JSON.stringify([savedRound()]));
    renderApp();
    expectFeatured(false);
  });

  it('does not feature the sample on a device already marked, with no saved rounds', () => {
    localStorage.setItem(ROUND_USED_KEY, '1');
    renderApp();
    expectFeatured(false);
  });
});

describe('useRound marking this device as having used rounds', () => {
  it('does not mark it when a sample round is saved through the hook', () => {
    const { result } = renderHook(() => useRound());
    act(() => result.current.startSample({}));
    const persist = vi.fn();
    act(() => { result.current.save('default', persist); });

    expect(persist).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(ROUND_USED_KEY)).toBeNull();
  });
});
