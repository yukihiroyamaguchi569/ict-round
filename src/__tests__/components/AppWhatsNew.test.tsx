import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import {
  LAST_SEEN_KEY,
  renderApp,
  startRound,
  homeButton,
  stubFetch,
  releasesResponse,
  registerAppTestHooks,
} from './appTestHelpers';

// See appStubs.tsx for why these screens are stubbed.
vi.mock('../../components/PhotoForm', () => import('./appStubs').then((m) => ({ default: m.PhotoFormStub })));
vi.mock('../../components/ReportPreview', () => import('./appStubs').then((m) => ({ default: m.ReportPreviewStub })));
vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));

registerAppTestHooks();

describe("App what's new", () => {
  const RELEASES = [
    { version: __APP_VERSION__, date: '2026-10-05', changes: ['最新の変更'] },
    { version: '0.0.1', date: '2026-01-01', changes: ['古い変更'] },
    { version: '999.0.0', date: '2099-01-01', changes: ['未来の変更'] },
  ];

  it('shows the latest released entry on first launch and records it when closed', async () => {
    localStorage.removeItem(LAST_SEEN_KEY);
    const fetchMock = stubFetch(releasesResponse(RELEASES));
    const { user, container } = renderApp();

    const dialog = await screen.findByRole('dialog', { name: '新機能のお知らせ' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/updates\/releases\.json$/);
    expect(within(dialog).getByText('最新の変更')).toBeInTheDocument();
    expect(within(dialog).queryByText('古い変更')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('未来の変更')).not.toBeInTheDocument();
    // The start screen is out of reach while the dialog is open.
    expect(container.querySelector('[inert]')).toContainElement(screen.getByRole('button', { name: 'ラウンド開始', hidden: true }));
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBeNull();

    await user.click(within(dialog).getByRole('button'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container.querySelector('[inert]')).toBeNull();
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBe(__APP_VERSION__);
  });

  it('shows every entry newer than the last seen version', async () => {
    localStorage.setItem(LAST_SEEN_KEY, '0.0.0');
    stubFetch(releasesResponse(RELEASES));
    renderApp();

    const dialog = await screen.findByRole('dialog', { name: '新機能のお知らせ' });
    expect(within(dialog).getByText('最新の変更')).toBeInTheDocument();
    expect(within(dialog).getByText('古い変更')).toBeInTheDocument();
  });

  it('does not fetch when the current version was already seen', async () => {
    const fetchMock = stubFetch(releasesResponse(RELEASES));
    const { container } = renderApp();

    await Promise.resolve();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(container.querySelector('[inert]')).toBeNull();
  });

  it('shows nothing and records nothing when the fetch fails', async () => {
    localStorage.removeItem(LAST_SEEN_KEY);
    const fetchMock = stubFetch(() => Promise.reject(new Error('offline')));
    renderApp();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBeNull();
  });

  it('shows nothing and records nothing when no entry is unseen', async () => {
    localStorage.removeItem(LAST_SEEN_KEY);
    const fetchMock = stubFetch(releasesResponse([RELEASES[2]]));
    renderApp();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(LAST_SEEN_KEY)).toBeNull();
  });

  it('keeps the announcement for the start screen when a round is started before it arrives', async () => {
    localStorage.removeItem(LAST_SEEN_KEY);
    let resolveFetch: (value: unknown) => void = () => {};
    stubFetch(() => new Promise((resolve) => (resolveFetch = resolve)));
    const { user } = renderApp();
    await startRound(user);

    resolveFetch({ ok: true, json: () => Promise.resolve(RELEASES) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(homeButton());
    expect(await screen.findByRole('dialog', { name: '新機能のお知らせ' })).toBeInTheDocument();
  });
});
