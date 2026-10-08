import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoundStart from '../../components/RoundStart';
import { ThemeProvider } from '../../ThemeContext';
import { IconProvider } from '../../IconContext';
import { trackEvent } from '../../analytics';
import { appShareData, appShareMailto, openMailDraft } from '../../appShare';

vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));
// jsdom cannot navigate to mailto:, so replace only the navigation boundary
vi.mock('../../appShare', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../appShare')>()),
  openMailDraft: vi.fn(),
}));

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

function stubShare(impl: () => Promise<void>) {
  const share = vi.fn<(data: ShareData) => Promise<void>>(impl);
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  return share;
}

function shareButton() {
  return screen.getByRole('button', { name: '同僚に紹介する' });
}

beforeEach(() => {
  vi.mocked(trackEvent).mockClear();
  vi.mocked(openMailDraft).mockClear();
});

afterEach(() => {
  // Remove the own property so jsdom's navigator has no share API again
  Reflect.deleteProperty(navigator, 'share');
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

  it('sits between the merge card and the version line', () => {
    renderStart();
    const merge = screen.getByText('複数部署のレポートを統合');
    const about = screen.getByRole('link', { name: 'めぐる君について' });
    const version = screen.getByText(/ICTラウンドアプリ「めぐる君」 v/);
    expect(merge.compareDocumentPosition(about) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(about.compareDocumentPosition(version) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('RoundStart share button', () => {
  it('opens the share sheet and records a share once it completes, without opening mail', async () => {
    const share = stubShare(() => Promise.resolve());
    const user = renderStart();
    await user.click(shareButton());

    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith(appShareData());
    expect(openMailDraft).not.toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('app_share', { method: 'share' });
  });

  it('does nothing when the share sheet is cancelled', async () => {
    const share = stubShare(() => Promise.reject(new DOMException('Share canceled', 'AbortError')));
    const user = renderStart();
    await user.click(shareButton());

    expect(share).toHaveBeenCalledTimes(1);
    expect(openMailDraft).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('opens a new mail when the browser has no share sheet', async () => {
    const user = renderStart();
    await user.click(shareButton());

    expect(openMailDraft).toHaveBeenCalledTimes(1);
    expect(openMailDraft).toHaveBeenCalledWith(appShareMailto());
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('app_share', { method: 'email' });
  });

  it.each([
    ['NotAllowedError', new DOMException('no activation', 'NotAllowedError')],
    ['TypeError', new TypeError('bad data')],
  ])('falls back to a new mail when sharing fails with %s', async (_, err) => {
    const share = stubShare(() => Promise.reject(err));
    const user = renderStart();
    await user.click(shareButton());

    expect(share).toHaveBeenCalledTimes(1);
    expect(openMailDraft).toHaveBeenCalledTimes(1);
    expect(openMailDraft).toHaveBeenCalledWith(appShareMailto());
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('app_share', { method: 'email' });
  });

  it('ignores a second tap while the share sheet is open, so it does not fall back to mail', async () => {
    let finish: () => void = () => undefined;
    const share = stubShare(() => new Promise<void>((resolve) => { finish = resolve; }));
    const user = renderStart();
    await user.click(shareButton());
    await user.click(shareButton());
    expect(share).toHaveBeenCalledTimes(1);
    expect(openMailDraft).not.toHaveBeenCalled();

    finish();
    await vi.waitFor(() => expect(trackEvent).toHaveBeenCalledWith('app_share', { method: 'share' }));
    expect(trackEvent).toHaveBeenCalledTimes(1);

    // Once the sheet closes the button works again
    await user.click(shareButton());
    expect(share).toHaveBeenCalledTimes(2);
  });

  it('can share again after a cancelled sheet', async () => {
    const share = stubShare(() => Promise.reject(new DOMException('Share canceled', 'AbortError')));
    const user = renderStart();
    await user.click(shareButton());
    await user.click(shareButton());
    expect(share).toHaveBeenCalledTimes(2);
    expect(openMailDraft).not.toHaveBeenCalled();
  });
});
