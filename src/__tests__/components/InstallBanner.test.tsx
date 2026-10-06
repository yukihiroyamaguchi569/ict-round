import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstallBanner from '../../components/InstallBanner';
import { IconProvider } from '../../IconContext';
import { trackEvent } from '../../analytics';

vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));

const DISMISSED_KEY = 'pwa_banner_dismissed';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1';

beforeEach(() => {
  vi.mocked(trackEvent).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderBanner() {
  const result = render(
    <IconProvider>
      <InstallBanner />
    </IconProvider>,
  );
  return { ...result, user: userEvent.setup() };
}

/** Fires the browser's install prompt event; resolves the user's choice with the given outcome. */
function fireInstallPrompt(outcome: 'accepted' | 'dismissed') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(() => Promise.resolve()),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

function useUserAgent(ua: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
}

function addButton() {
  return screen.getByRole('button', { name: '追加' });
}

function bannerCloseButton() {
  return screen.getByRole('button', { name: '閉じる' });
}

describe('InstallBanner: when to show', () => {
  it('shows nothing when the browser offers no way to install', () => {
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing on iOS Chrome, which cannot add to the home screen', () => {
    useUserAgent(IPHONE_CHROME);
    const { container } = renderBanner();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing once dismissed, even when the browser offers a prompt', () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    const { container } = renderBanner();
    fireInstallPrompt('accepted');
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the banner once the browser offers an install prompt', () => {
    renderBanner();
    fireInstallPrompt('accepted');
    expect(screen.getByText('ホーム画面に追加')).toBeInTheDocument();
    expect(addButton()).toBeInTheDocument();
  });
});

describe('InstallBanner: install prompt', () => {
  it('records the click and the accepted result, then hides the banner for good', async () => {
    const { container, unmount, user } = renderBanner();
    const event = fireInstallPrompt('accepted');
    expect(event.defaultPrevented).toBe(true);

    await user.click(addButton());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(vi.mocked(trackEvent).mock.calls).toEqual([
      ['pwa_install_banner_click', { method: 'prompt' }],
      ['pwa_install_prompt_result', { outcome: 'accepted' }],
    ]);
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('1');

    unmount();
    const again = renderBanner();
    fireInstallPrompt('accepted');
    expect(again.container).toBeEmptyDOMElement();
  });

  it('records a declined prompt without remembering a dismissal', async () => {
    const { container, user } = renderBanner();
    const event = fireInstallPrompt('dismissed');

    await user.click(addButton());
    // The used prompt cannot be shown again, so the banner goes away until the browser offers a new one
    await waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(vi.mocked(trackEvent).mock.calls).toEqual([
      ['pwa_install_banner_click', { method: 'prompt' }],
      ['pwa_install_prompt_result', { outcome: 'dismissed' }],
    ]);
    expect(localStorage.getItem(DISMISSED_KEY)).toBeNull();
    expect(screen.queryByText('ホーム画面に追加する')).not.toBeInTheDocument();

    fireInstallPrompt('accepted');
    expect(addButton()).toBeInTheDocument();
  });

  it('does not open the iOS guide for a prompt install', async () => {
    const { user } = renderBanner();
    fireInstallPrompt('dismissed');
    await user.click(addButton());
    expect(screen.queryByText('Safariの共有メニューから追加できます')).not.toBeInTheDocument();
  });
});

describe('InstallBanner: iOS Safari', () => {
  beforeEach(() => {
    useUserAgent(IPHONE_SAFARI);
  });

  it('opens the manual steps on 追加 and closes them without dismissing the banner', async () => {
    const { user } = renderBanner();
    expect(screen.queryByText('ホーム画面に追加する')).not.toBeInTheDocument();

    await user.click(addButton());
    expect(vi.mocked(trackEvent).mock.calls).toEqual([['pwa_install_banner_click', { method: 'ios-manual' }]]);
    const guide = screen.getByText('ホーム画面に追加する').parentElement as HTMLElement;
    expect(within(guide).getByText('Safariの共有メニューから追加できます')).toBeInTheDocument();
    expect(within(guide).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '1画面下の共有ボタンをタップ',
      '2「ホーム画面に追加」を選択',
      '3右上の「追加」をタップ',
    ]);

    await user.click(within(guide).getByRole('button', { name: '閉じる' }));
    expect(screen.queryByText('ホーム画面に追加する')).not.toBeInTheDocument();
    expect(addButton()).toBeInTheDocument();
    expect(localStorage.getItem(DISMISSED_KEY)).toBeNull();
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('records the dismissal, hides the banner and keeps it hidden after a reload', async () => {
    const { container, unmount, user } = renderBanner();
    await user.click(bannerCloseButton());

    expect(container).toBeEmptyDOMElement();
    expect(vi.mocked(trackEvent).mock.calls).toEqual([['pwa_install_banner_dismiss', { method: 'ios-manual' }]]);
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('1');

    unmount();
    expect(renderBanner().container).toBeEmptyDOMElement();
  });
});

describe('InstallBanner: dismissing a prompt banner', () => {
  it('records the dismissal with the prompt method and never shows the prompt', async () => {
    const { container, user } = renderBanner();
    const event = fireInstallPrompt('accepted');
    await user.click(bannerCloseButton());

    expect(container).toBeEmptyDOMElement();
    expect(vi.mocked(trackEvent).mock.calls).toEqual([['pwa_install_banner_dismiss', { method: 'prompt' }]]);
    expect(event.prompt).not.toHaveBeenCalled();
    expect(localStorage.getItem(DISMISSED_KEY)).toBe('1');
  });
});
