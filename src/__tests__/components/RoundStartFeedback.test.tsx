import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoundStart from '../../components/RoundStart';
import { ThemeProvider } from '../../ThemeContext';
import { IconProvider } from '../../IconContext';
import { trackEvent } from '../../analytics';

vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));

const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLSeW5eVVamKxZBNqy__NQAjRdaMeZBo8Y7Os4CpX5KhKIQsugA/viewform';
const IPAD_AS_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

function renderStart(featureSample = true) {
  render(
    <ThemeProvider>
      <IconProvider>
        <RoundStart
          library={[]}
          activeId=""
          savedRoundsCount={0}
          featureSample={featureSample}
          initialName=""
          onStart={vi.fn()}
          onStartSample={vi.fn(() => Promise.resolve())}
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

function stubDevice(userAgent: string, maxTouchPoints: number) {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
}

const feedbackLink = () => screen.getByRole('link', { name: 'ご意見・ご要望' });

// jsdom cannot open a new tab, so stop the browser default while React handlers still run
const preventNavigation = (e: MouseEvent) => {
  if (e.target instanceof Element && e.target.closest('a')) e.preventDefault();
};

beforeEach(() => {
  vi.mocked(trackEvent).mockClear();
  document.addEventListener('click', preventNavigation);
  stubDevice(IPAD_AS_MAC, 5);
});

afterEach(() => {
  document.removeEventListener('click', preventNavigation);
  // Remove the own properties so jsdom's navigator is back to its defaults
  Reflect.deleteProperty(navigator, 'userAgent');
  Reflect.deleteProperty(navigator, 'maxTouchPoints');
});

describe('RoundStart feedback link', () => {
  it('opens the inquiry form pre-filled with the version and the device in a new tab', () => {
    renderStart();
    const link = feedbackLink();
    expect(link).toHaveAttribute(
      'href',
      `${FORM}?usp=pp_url&entry.999783493=${encodeURIComponent(__APP_VERSION__)}&entry.2044868744=iPad`,
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('fills in a computer when the browser is not a phone or a tablet', () => {
    stubDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36', 0);
    renderStart();
    const params = new URL(feedbackLink().getAttribute('href') ?? '').searchParams;
    expect(params.get('entry.2044868744')).toBe('パソコン');
  });

  it('records the open from the start screen', async () => {
    const user = renderStart();

    await user.click(feedbackLink());

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('feedback_open', { from: 'start' });
  });

  it('comes last among the quiet links, also when the sample has moved there', () => {
    renderStart(false);
    const links = feedbackLink().parentElement;
    expect(links?.lastElementChild).toHaveTextContent('ご意見・ご要望');
    expect(links?.firstElementChild).toHaveTextContent('サンプルデータで試す');
    // Wraps onto more lines on a narrow screen instead of overflowing
    expect(links).toHaveClass('flex-wrap');
  });

  it('keeps the names typed on the start screen out of the URL', async () => {
    const user = renderStart();
    const before = feedbackLink().getAttribute('href');

    await user.type(screen.getByPlaceholderText('例: 山田 花子'), '山田 花子');
    await user.type(screen.getByPlaceholderText('例: 3階東病棟'), '3階東病棟');

    const href = feedbackLink().getAttribute('href') ?? '';
    expect(href).toBe(before);
    expect(decodeURIComponent(href)).not.toMatch(/山田|3階東病棟/);
  });
});
