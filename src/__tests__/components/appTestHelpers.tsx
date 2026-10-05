import { afterEach, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import type { RoundData, SavedChecklist, SavedRound } from '../../types';

export const LIBRARY_KEY = 'icn-round:checklist-library';
export const ACTIVE_ID_KEY = 'icn-round:active-checklist-id';
export const ROUNDS_KEY = 'icn-round:saved-rounds';
export const LAST_SEEN_KEY = 'icn-round:last-seen-version';

export const LIBRARY: SavedChecklist[] = [
  {
    id: 'ward',
    name: '病棟用',
    createdAt: '2026-01-01T00:00:00.000Z',
    categories: [
      {
        category: '手指衛生',
        items: [
          { id: 'h1', category: '手指衛生', description: '手指消毒剤が配置されている' },
          { id: 'h2', category: '手指衛生', description: '5つのタイミングが掲示されている' },
        ],
      },
    ],
  },
  {
    id: 'clinic',
    name: '外来用',
    createdAt: '2026-02-01T00:00:00.000Z',
    categories: [
      {
        category: '環境',
        items: [
          { id: 'e1', category: '環境', description: '床が清掃されている' },
          { id: 'e2', category: '環境', description: '棚に埃がない' },
          { id: 'e3', category: '環境', description: 'シンク周りが乾いている' },
        ],
      },
    ],
  },
];

export const START_TIME = '2026/10/06 07:00';

export function seedLibrary(activeId = 'ward') {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(LIBRARY));
  localStorage.setItem(ACTIVE_ID_KEY, activeId);
}

export function storedRounds(): SavedRound[] {
  return JSON.parse(localStorage.getItem(ROUNDS_KEY) ?? '[]') as SavedRound[];
}

export function storedLibraryIds(): string[] {
  return (JSON.parse(localStorage.getItem(LIBRARY_KEY) ?? '[]') as SavedChecklist[]).map((c) => c.id);
}

export function savedRound(overrides: Partial<SavedRound> = {}): SavedRound {
  return {
    id: 'saved-1',
    title: '佐藤 / 外来（2026/10/01 09:00）',
    savedAt: '2026-10-01T00:00:00.000Z',
    version: 1,
    checklistId: 'clinic',
    roundData: {
      inspectorName: '佐藤',
      wardName: '外来',
      startTime: '2026/10/01 09:00',
      checklistResults: [
        {
          itemId: 'e1',
          rating: 'B',
          photos: [{ id: 'ip1', dataUrl: 'data:image/jpeg;base64,BB', comment: '床の汚れ', timestamp: '09:10' }],
        },
        { itemId: 'e2', rating: null, photos: [] },
        { itemId: 'e3', rating: null, photos: [] },
      ],
      generalPhotos: [],
      overallEvaluation: '保存した総評',
      checklistName: '外来用',
    },
    ...overrides,
  };
}

export function renderApp() {
  const view = render(<App />);
  return { ...view, user: userEvent.setup() };
}

export type User = ReturnType<typeof userEvent.setup>;

export async function startRound(user: User, name = '山田 花子', ward = '3階東病棟') {
  await user.type(screen.getByPlaceholderText('例: 山田 花子'), name);
  if (ward) await user.type(screen.getByPlaceholderText('例: 3階東病棟'), ward);
  await user.click(screen.getByRole('button', { name: 'ラウンド開始' }));
}

export function progress() {
  return screen.getByTestId('overall-progress');
}

export function tab(label: 'チェック' | '写真' | '総評') {
  return screen.getByRole('button', { name: new RegExp(`${label}$`) });
}

export function homeButton() {
  return screen.getByRole('button', { name: 'トップ画面に戻る' });
}

export function saveButton() {
  return screen.getByRole('button', { name: '保存' });
}

export function leaveDialogHeading() {
  return screen.queryByRole('heading', { name: 'トップ画面に戻りますか？' });
}

export function isStartScreen() {
  return screen.queryByRole('button', { name: 'ラウンド開始' }) !== null;
}

/** Opens the report screen, reads the round data App passed to it, and comes back. */
export async function reportRound(user: User): Promise<RoundData> {
  await user.click(screen.getByRole('button', { name: 'レポート' }));
  const data = JSON.parse(screen.getByTestId('report-round').textContent ?? '') as RoundData;
  await user.click(screen.getByRole('button', { name: 'stub-back' }));
  return data;
}

export async function rateFirstItem(user: User, rating: 'A' | 'B' | 'C' = 'A') {
  await user.click(screen.getAllByRole('button', { name: rating })[0]);
}

export function stubFetch(impl: () => Promise<unknown>) {
  const fetchMock = vi.fn<(input: unknown) => Promise<unknown>>(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export function releasesResponse(releases: unknown) {
  return () => Promise.resolve({ ok: true, json: () => Promise.resolve(releases) });
}

/** Makes writes of the saved-round list throw; other keys are stored as usual. */
export function failSavingRounds(error: Error) {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
    if (key === ROUNDS_KEY) throw error;
    original.call(this, key, value);
  });
}

/** Fixed clock and time zone, the two-checklist library, and a quiet what's-new check for every test. */
export function registerAppTestHooks() {
  beforeEach(() => {
    vi.stubEnv('TZ', 'Asia/Tokyo');
    vi.useFakeTimers({ toFake: ['Date'] });
    // 07:00 on 2026-10-06 in Tokyo
    vi.setSystemTime(new Date('2026-10-05T22:00:00Z'));
    seedLibrary();
    // AppWhatsNew.test.tsx covers the announcement; keep it quiet elsewhere.
    localStorage.setItem(LAST_SEEN_KEY, __APP_VERSION__);
    stubFetch(() => Promise.reject(new Error('offline')));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });
}
