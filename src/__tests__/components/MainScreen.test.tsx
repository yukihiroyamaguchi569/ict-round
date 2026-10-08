import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MainScreen from '../../components/MainScreen';
import { ThemeProvider } from '../../ThemeContext';
import { IconProvider } from '../../IconContext';
import type { ChecklistCategory, Photo, RoundData } from '../../types';
import { trackEvent } from '../../analytics';

vi.mock('../../analytics', () => ({ trackEvent: vi.fn() }));

const CATEGORIES: ChecklistCategory[] = [
  {
    category: '手指衛生',
    items: [
      { id: 'h1', category: '手指衛生', description: '手指消毒剤が配置されている' },
      { id: 'h2', category: '手指衛生', description: '5つのタイミングが掲示されている' },
    ],
  },
  { category: '環境', items: [{ id: 'e1', category: '環境', description: '床が清掃されている' }] },
];

function photo(id: string): Photo {
  return { id, dataUrl: 'data:image/jpeg;base64,AA', comment: '', timestamp: '07:05' };
}

function round(overrides: Partial<RoundData> = {}): RoundData {
  return {
    inspectorName: '山田 花子',
    wardName: '3階東病棟',
    startTime: '2026/10/06 07:00',
    checklistResults: [
      { itemId: 'h1', rating: null, photos: [] },
      { itemId: 'h2', rating: null, photos: [] },
      { itemId: 'e1', rating: null, photos: [] },
    ],
    generalPhotos: [],
    overallEvaluation: '',
    ...overrides,
  };
}

type Props = Parameters<typeof MainScreen>[0];

function setup(overrides: Partial<Props> = {}) {
  const props: Props = {
    roundData: round(),
    categories: CATEGORIES,
    activeTab: 'checklist',
    onTabChange: vi.fn(),
    onRatingChange: vi.fn(),
    onAddPhoto: vi.fn(),
    onDeleteItemPhoto: vi.fn(),
    onDeleteGeneralPhoto: vi.fn(),
    onEvaluationChange: vi.fn(),
    onInspectorChange: vi.fn(),
    onReport: vi.fn(),
    onSave: vi.fn(() => true),
    onHome: vi.fn(),
    ...overrides,
  };
  const view = render(
    <ThemeProvider>
      <IconProvider>
        <MainScreen {...props} />
      </IconProvider>
    </ThemeProvider>,
  );
  const rerender = (next: Partial<Props>) =>
    view.rerender(
      <ThemeProvider>
        <IconProvider>
          <MainScreen {...props} {...next} />
        </IconProvider>
      </ThemeProvider>,
    );
  return { props, rerender, user: userEvent.setup() };
}

function inspectorButton() {
  return screen.getByRole('button', { name: /^参加者:/ });
}

function inspectorInput() {
  return screen.queryByPlaceholderText('参加者名');
}

function saveButton() {
  return screen.getByRole('button', { name: '保存' });
}

function tab(label: string) {
  return screen.getByRole('button', { name: new RegExp(`${label}$`) });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('MainScreen header: participant name', () => {
  it('shows the participant and the ward', () => {
    setup();
    expect(inspectorButton()).toHaveTextContent('参加者: 山田 花子・3階東病棟');
  });

  it('shows a placeholder for an empty name and leaves out an empty ward', () => {
    setup({ roundData: round({ inspectorName: '', wardName: '' }) });
    expect(inspectorButton()).toHaveTextContent(/^参加者: （未入力）$/);
  });

  it('starts editing from the current name with the input focused', async () => {
    const { user } = setup();
    await user.click(inspectorButton());

    expect(inspectorInput()).toHaveValue('山田 花子');
    expect(inspectorInput()).toHaveFocus();
    expect(screen.queryByRole('button', { name: /^参加者:/ })).not.toBeInTheDocument();
  });

  it('Enter commits the trimmed name and ends editing', async () => {
    const { props, user } = setup();
    await user.click(inspectorButton());
    await user.clear(screen.getByPlaceholderText('参加者名'));
    await user.type(screen.getByPlaceholderText('参加者名'), '  鈴木 一郎  {Enter}');

    expect(props.onInspectorChange).toHaveBeenCalledTimes(1);
    expect(props.onInspectorChange).toHaveBeenCalledWith('鈴木 一郎');
    expect(inspectorInput()).not.toBeInTheDocument();
  });

  it('leaving the input commits the name', async () => {
    const { props, user } = setup();
    await user.click(inspectorButton());
    await user.type(screen.getByPlaceholderText('参加者名'), '子');
    await user.click(saveButton());

    expect(props.onInspectorChange).toHaveBeenCalledWith('山田 花子子');
    expect(inspectorInput()).not.toBeInTheDocument();
  });

  it('a blank name is committed as an empty string', async () => {
    const { props, user } = setup();
    await user.click(inspectorButton());
    await user.clear(screen.getByPlaceholderText('参加者名'));
    await user.type(screen.getByPlaceholderText('参加者名'), '   {Enter}');

    expect(props.onInspectorChange).toHaveBeenCalledWith('');
  });

  it('Escape cancels editing without committing', async () => {
    const { props, user } = setup();
    await user.click(inspectorButton());
    await user.type(screen.getByPlaceholderText('参加者名'), '変更{Escape}');

    expect(props.onInspectorChange).not.toHaveBeenCalled();
    expect(inspectorInput()).not.toBeInTheDocument();
    expect(inspectorButton()).toHaveTextContent('参加者: 山田 花子・3階東病棟');
  });

  it('editing again starts from the current name, not the discarded draft', async () => {
    const { user, rerender } = setup();
    await user.click(inspectorButton());
    await user.type(screen.getByPlaceholderText('参加者名'), '変更{Escape}');
    rerender({ roundData: round({ inspectorName: '佐藤' }) });
    await user.click(inspectorButton());

    expect(inspectorInput()).toHaveValue('佐藤');
  });
});

describe('MainScreen header: save feedback', () => {
  it('shows 保存済み for 2 seconds after a successful save', () => {
    vi.useFakeTimers();
    const { props } = setup();
    fireEvent.click(saveButton());

    expect(props.onSave).toHaveBeenCalledTimes(1);
    expect(saveButton()).toHaveTextContent('保存済み');
    expect(saveButton()).toHaveStyle({ backgroundColor: '#059669' });
    act(() => vi.advanceTimersByTime(1999));
    expect(saveButton()).toHaveTextContent('保存済み');
    act(() => vi.advanceTimersByTime(1));
    expect(saveButton()).toHaveTextContent(/^保存$/);
    expect(saveButton()).toHaveStyle({ backgroundColor: 'var(--t-primary-light)' });
  });

  it('shows no feedback when the save fails', () => {
    vi.useFakeTimers();
    setup({ onSave: vi.fn(() => false) });
    fireEvent.click(saveButton());

    expect(saveButton()).toHaveTextContent(/^保存$/);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a second save does not extend the feedback started by the first', () => {
    vi.useFakeTimers();
    const { props } = setup();
    fireEvent.click(saveButton());
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(saveButton());

    expect(props.onSave).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(1000));
    expect(saveButton()).toHaveTextContent(/^保存$/);
  });
});

describe('MainScreen header: progress and home', () => {
  it('shows rated / total items', () => {
    setup({
      roundData: round({
        checklistResults: [
          { itemId: 'h1', rating: 'A', photos: [] },
          { itemId: 'h2', rating: null, photos: [] },
          { itemId: 'e1', rating: 'C', photos: [] },
        ],
      }),
    });
    const badge = screen.getByTestId('overall-progress');
    expect(badge).toHaveTextContent(/^2\/3$/);
    expect(badge).toHaveStyle({ backgroundColor: 'var(--t-primary-light)', color: 'var(--t-primary)' });
  });

  it('turns green when every item is rated', () => {
    setup({
      roundData: round({
        checklistResults: [
          { itemId: 'h1', rating: 'A', photos: [] },
          { itemId: 'h2', rating: 'B', photos: [] },
          { itemId: 'e1', rating: 'C', photos: [] },
        ],
      }),
    });
    const badge = screen.getByTestId('overall-progress');
    expect(badge).toHaveTextContent(/^3\/3$/);
    expect(badge).toHaveStyle({ backgroundColor: '#059669', color: '#fff' });
  });

  it('the icon button goes home', async () => {
    const { props, user } = setup();
    await user.click(screen.getByRole('button', { name: 'トップ画面に戻る' }));
    expect(props.onHome).toHaveBeenCalledTimes(1);
  });
});

describe('MainScreen tabs', () => {
  it('shows the checklist tab', () => {
    setup({ activeTab: 'checklist' });
    expect(screen.getByText('入力進捗')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '写真を追加' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows the photo tab', () => {
    setup({ activeTab: 'photos' });
    expect(screen.getByRole('button', { name: '写真を追加' })).toBeInTheDocument();
    expect(screen.queryByText('入力進捗')).not.toBeInTheDocument();
  });

  it('shows the evaluation tab with the current text', () => {
    setup({ activeTab: 'evaluation', roundData: round({ overallEvaluation: '良好' }) });
    expect(screen.getByRole('textbox')).toHaveValue('良好');
    expect(screen.queryByText('入力進捗')).not.toBeInTheDocument();
  });

  it('passes rating, photo and evaluation changes up', async () => {
    const { props, user, rerender } = setup();
    await user.click(screen.getAllByRole('button', { name: 'A' })[0]);
    expect(props.onRatingChange).toHaveBeenCalledWith('h1', 'A');

    rerender({ activeTab: 'photos' });
    await user.click(screen.getByRole('button', { name: '写真を追加' }));
    expect(props.onAddPhoto).toHaveBeenCalledWith(undefined);

    rerender({ activeTab: 'evaluation' });
    await user.type(screen.getByRole('textbox'), 'x');
    expect(props.onEvaluationChange).toHaveBeenCalledWith('x');
  });

  it('passes photo deletions up', async () => {
    const { props, user } = setup({
      activeTab: 'photos',
      roundData: round({
        checklistResults: [
          { itemId: 'h1', rating: null, photos: [photo('ip1')] },
          { itemId: 'h2', rating: null, photos: [] },
          { itemId: 'e1', rating: null, photos: [] },
        ],
        generalPhotos: [photo('gp1')],
      }),
    });
    const [itemDelete, generalDelete] = screen.getAllByRole('button', { name: '削除' });
    await user.click(itemDelete);
    await user.click(generalDelete);

    expect(props.onDeleteItemPhoto).toHaveBeenCalledWith('h1', 'ip1');
    expect(props.onDeleteGeneralPhoto).toHaveBeenCalledWith('gp1');
  });

  it('switches tabs and opens the report through the bottom bar', async () => {
    const { props, user } = setup();
    await user.click(tab('写真'));
    expect(props.onTabChange).toHaveBeenCalledWith('photos');
    await user.click(screen.getByRole('button', { name: 'レポート' }));
    expect(props.onReport).toHaveBeenCalledTimes(1);
  });

  it('marks the active tab', () => {
    setup({ activeTab: 'evaluation' });
    expect(tab('総評')).toHaveAttribute('aria-current', 'page');
    expect(tab('チェック')).not.toHaveAttribute('aria-current');
  });

  it('counts item-linked and general photos on the photo tab', () => {
    setup({
      roundData: round({
        checklistResults: [
          { itemId: 'h1', rating: null, photos: [photo('a'), photo('b')] },
          { itemId: 'h2', rating: null, photos: [] },
          { itemId: 'e1', rating: null, photos: [photo('c')] },
        ],
        generalPhotos: [photo('d')],
      }),
    });
    expect(within(tab('写真')).getByText('4')).toBeInTheDocument();
  });

  it('marks the evaluation tab only when the evaluation has non-blank text', () => {
    const { rerender } = setup({ roundData: round({ overallEvaluation: '   ' }) });
    expect(screen.queryByRole('img', { name: '記入済み' })).not.toBeInTheDocument();
    rerender({ roundData: round({ overallEvaluation: ' 良好 ' }) });
    expect(screen.getByRole('img', { name: '記入済み' })).toBeInTheDocument();
  });
});

describe('MainScreen help link', () => {
  // The round lives only in React state until saved, so the guide must never replace this tab
  it('opens the user guide in a new tab so the unsaved round is kept', () => {
    setup();
    const link = screen.getByRole('link', { name: '使い方' });
    expect(link).toHaveAttribute('href', './docs/user-guide/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
  });

  it('records the open from the round and leaves the round untouched', async () => {
    vi.mocked(trackEvent).mockClear();
    const { props, user } = setup();
    await user.click(screen.getByRole('link', { name: '使い方' }));
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('help_open', { from: 'round' });
    expect(props.onSave).not.toHaveBeenCalled();
    expect(props.onHome).not.toHaveBeenCalled();
  });

  it('sits in the header to the left of the save button', () => {
    setup();
    const link = screen.getByRole('link', { name: '使い方' });
    expect(link.compareDocumentPosition(saveButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(link.parentElement).toBe(saveButton().parentElement);
  });
});
