import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoundStart from '../../components/RoundStart';
import { ThemeProvider } from '../../ThemeContext';
import { IconProvider } from '../../IconContext';
import { trackEvent } from '../../analytics';
import { appShareData, appShareLineUrl, appShareMailto, appShareUrl, appShareXUrl } from '../../appShare';

vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));

function renderStart() {
  render(
    <ThemeProvider>
      <IconProvider>
        <RoundStart
          library={[]}
          activeId=""
          savedRoundsCount={0}
          initialName=""
          onStart={vi.fn()}
          onSelectChecklist={vi.fn()}
          onAddChecklist={vi.fn()}
          onDeleteChecklist={vi.fn()}
          onViewSaved={vi.fn()}
        />
      </IconProvider>
    </ThemeProvider>,
  );
  return userEvent.setup();
}

/** Renders the start screen and opens the share dialog. */
async function openDialog() {
  const user = renderStart();
  await user.click(screen.getByRole('button', { name: '同僚に紹介する' }));
  return { user, dialog: screen.getByRole('dialog', { name: '同僚に紹介する' }) };
}

function stubShare(impl: () => Promise<void>) {
  const share = vi.fn<(data: ShareData) => Promise<void>>(impl);
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  return share;
}

/** Replaces the clipboard; call after userEvent.setup(), which installs its own. */
function stubClipboard(clipboard: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
}

// jsdom cannot follow links (mailto: in particular), so stop the browser default while React handlers still run
const preventNavigation = (e: MouseEvent) => {
  if (e.target instanceof Element && e.target.closest('a')) e.preventDefault();
};

beforeEach(() => {
  vi.mocked(trackEvent).mockClear();
  document.addEventListener('click', preventNavigation);
});

afterEach(() => {
  document.removeEventListener('click', preventNavigation);
  // Remove the own properties so jsdom's navigator is back to its defaults
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'clipboard');
  vi.restoreAllMocks();
});

describe('RoundStart about link', () => {
  it('opens the About page in a new tab and records the click', async () => {
    const user = renderStart();
    const link = screen.getByRole('link', { name: 'めぐる君について' });
    expect(link).toHaveAttribute('href', './about/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');

    await user.click(link);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('about_link_click');
  });

  it('sits with the share button between the merge card and the version line', () => {
    renderStart();
    const merge = screen.getByText('複数部署のレポートを統合');
    const about = screen.getByRole('link', { name: 'めぐる君について' });
    const shareButton = screen.getByRole('button', { name: '同僚に紹介する' });
    const version = screen.getByText(/ICTラウンドアプリ「めぐる君」 v/);
    const follows = (a: Node, b: Node) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(merge, about)).toBe(true);
    expect(follows(about, shareButton)).toBe(true);
    expect(follows(shareButton, version)).toBe(true);
  });
});

describe('RoundStart share dialog: opening and closing', () => {
  it('opens the dialog without sharing or recording anything', async () => {
    const share = stubShare(() => Promise.resolve());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const { dialog } = await openDialog();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(share).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('lists the destinations in order: mail, LINE, X, copy, other apps', async () => {
    stubShare(() => Promise.resolve());
    const { dialog } = await openDialog();
    const names = [...dialog.querySelectorAll('a, button')].map((el) => el.textContent?.trim());
    expect(names).toEqual(['メール', 'LINE', 'X', 'リンクをコピー', 'その他のアプリ', '閉じる']);
  });

  // .animate-page keeps its transform, which would become the containing block of position: fixed
  it('renders the dialog outside .animate-page, as a direct child of the screen root', async () => {
    const { dialog } = await openDialog();
    const overlay = dialog.closest('.fixed.inset-0');
    if (!overlay) throw new Error('overlay not found');
    expect(overlay.closest('.animate-page')).toBeNull();
    expect(overlay.parentElement).toBe(document.querySelector('.animate-page')?.parentElement);
  });

  it('closes with the close button', async () => {
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: '閉じる' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('closes with Escape', async () => {
    const { user } = await openDialog();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves focus into the dialog', async () => {
    const { dialog } = await openDialog();
    expect(dialog).toHaveFocus();
  });
});

describe('RoundStart share dialog: mail, LINE and X', () => {
  it.each([
    ['メール', 'email', appShareMailto()],
    ['LINE', 'line', appShareLineUrl()],
    ['X', 'x', appShareXUrl()],
  ])('links %s to its URL and records the tap', async (name, method, href) => {
    const { user, dialog } = await openDialog();
    const link = within(dialog).getByRole('link', { name });
    expect(link).toHaveAttribute('href', href);
    await user.click(link);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('app_share', { method });
  });

  it('opens mail in place but LINE and X in a new tab without a referrer', async () => {
    const { dialog } = await openDialog();
    expect(within(dialog).getByRole('link', { name: 'メール' })).not.toHaveAttribute('target');
    for (const name of ['LINE', 'X']) {
      const link = within(dialog).getByRole('link', { name });
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });
});

describe('RoundStart share dialog: copy link', () => {
  it('copies the copy-tagged URL, says so, and records the copy', async () => {
    const { user, dialog } = await openDialog();
    const writeText = vi.fn<(text: string) => Promise<void>>(() => Promise.resolve());
    stubClipboard({ writeText });
    await user.click(within(dialog).getByRole('button', { name: 'リンクをコピー' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(appShareUrl('copy'));
    expect(await within(dialog).findByText('コピーしました')).toBeInTheDocument();
    expect(within(dialog).queryByText('コピーできませんでした')).not.toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('app_share', { method: 'copy' });
  });

  it('shows the hint about pasting into apps such as Instagram', async () => {
    const { dialog } = await openDialog();
    expect(within(dialog).getByText('Instagram などに貼り付けて使えます')).toBeInTheDocument();
  });

  it.each([
    ['the write is refused', { writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) }],
    ['the browser has no Clipboard API', undefined],
  ])('shows the URL to select by hand and records nothing when %s', async (_, clipboard) => {
    const { user, dialog } = await openDialog();
    stubClipboard(clipboard);
    await user.click(within(dialog).getByRole('button', { name: 'リンクをコピー' }));

    expect(await within(dialog).findByText('コピーできませんでした')).toBeInTheDocument();
    expect(within(dialog).getByText(appShareUrl('copy'))).toHaveClass('select-all');
    expect(within(dialog).queryByText('コピーしました')).not.toBeInTheDocument();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('clears the copy result when the dialog is opened again', async () => {
    const { user, dialog } = await openDialog();
    stubClipboard({ writeText: () => Promise.resolve() });
    await user.click(within(dialog).getByRole('button', { name: 'リンクをコピー' }));
    await within(dialog).findByText('コピーしました');
    await user.click(within(dialog).getByRole('button', { name: '閉じる' }));
    await user.click(screen.getByRole('button', { name: '同僚に紹介する' }));
    expect(screen.queryByText('コピーしました')).not.toBeInTheDocument();
  });
});

describe('RoundStart share dialog: other apps', () => {
  it('offers other apps only when the browser has a share sheet', async () => {
    const { dialog } = await openDialog();
    expect(within(dialog).queryByRole('button', { name: 'その他のアプリ' })).not.toBeInTheDocument();
  });

  it('opens the share sheet and records a share once it completes', async () => {
    const share = stubShare(() => Promise.resolve());
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'その他のアプリ' }));

    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith(appShareData());
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('app_share', { method: 'share' });
  });

  it('does nothing when the share sheet is cancelled', async () => {
    const share = stubShare(() => Promise.reject(new DOMException('Share canceled', 'AbortError')));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'その他のアプリ' }));

    expect(share).toHaveBeenCalledTimes(1);
    expect(trackEvent).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('keeps the dialog open and records nothing when sharing fails', async () => {
    stubShare(() => Promise.reject(new DOMException('no activation', 'NotAllowedError')));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { user, dialog } = await openDialog();
    await user.click(within(dialog).getByRole('button', { name: 'その他のアプリ' }));

    expect(trackEvent).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole('link', { name: 'メール' })).toBeInTheDocument();
  });

  it('ignores a second tap while the share sheet is open', async () => {
    let finish: () => void = () => undefined;
    const share = stubShare(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { user, dialog } = await openDialog();
    const button = within(dialog).getByRole('button', { name: 'その他のアプリ' });
    await user.click(button);
    await user.click(button);
    expect(share).toHaveBeenCalledTimes(1);

    finish();
    await vi.waitFor(() => expect(trackEvent).toHaveBeenCalledWith('app_share', { method: 'share' }));
    expect(trackEvent).toHaveBeenCalledTimes(1);

    // Once the sheet closes the button works again
    await user.click(button);
    expect(share).toHaveBeenCalledTimes(2);
  });
});
