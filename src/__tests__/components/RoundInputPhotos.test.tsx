import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoundInputScreen from '../../facility/RoundInputScreen';
import { ThemeProvider } from '../../ThemeContext';
import { PHOTO_SAVE_ERROR_MESSAGE } from '../../facility/useRoundPhotos';
import { openFacilityDb } from '../../facility/roundDb';
import type { FacilityRound, RoundPhotoRef } from '../../facility/facilityRound';

// jsdom has no canvas: the picked file comes back as this image.
const PICKED = 'data:image/jpeg;base64,BBBB';
vi.mock('../../photoImage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../photoImage')>()),
  compressImage: vi.fn(async () => ({ dataUrl: PICKED, width: 640, height: 480 })),
}));

const IMAGE = 'data:image/jpeg;base64,AAAA';
const NG_ITEM = '高頻度接触面が清拭されている';
const OK_ITEM = '汚物処理室に汚れがない';
const OPEN_ITEM = '手指消毒剤が置かれている';

let factory: IDBFactory;

beforeEach(() => {
  vi.stubEnv('TZ', 'Asia/Tokyo');
  factory = new IDBFactory();
  vi.stubGlobal('indexedDB', factory);
  // jsdom does not implement scrolling.
  vi.stubGlobal('scrollTo', vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function ref(id: string, comment = ''): RoundPhotoRef {
  return { id, department: '3東', itemId: 'a', comment, takenAt: '2026-11-20T05:35:00.000Z' };
}

function round(photos: RoundPhotoRef[] = []): FacilityRound {
  return {
    version: 1,
    id: 'r1',
    startedAt: '2026-11-20T05:30:00.000Z',
    themeName: '環境整備',
    items: [
      { id: 'a', text: NG_ITEM, targetGroups: [], excludedDepartments: [] },
      { id: 'b', text: OK_ITEM, targetGroups: [], excludedDepartments: [] },
      { id: 'c', text: OPEN_ITEM, targetGroups: [], excludedDepartments: [] },
    ],
    departments: [{ name: '3東', group: '病棟' }],
    members: [],
    marks: { '3東': { a: 'ng', b: 'ok' } },
    departmentComments: {},
    overallComment: '',
    photos,
  };
}

async function seed(record: FacilityRound, images: { id: string; dataUrl: string }[] = []) {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('seed: open failed');
  await open.value.putRound(record);
  for (const image of images) await open.value.putPhoto({ ...image, roundId: record.id });
  open.value.close();
}

async function stored(): Promise<{ round: FacilityRound; images: unknown[] }> {
  const open = await openFacilityDb(factory);
  if (!open.ok) throw new Error('open failed');
  const read = await open.value.getRound('r1');
  const images = await open.value.getPhotos('r1');
  open.value.close();
  if (!read.ok || !images.ok) throw new Error('read failed');
  // Written by the code under test; read back only to inspect it.
  return { round: read.value as FacilityRound, images: images.value };
}

async function openDepartment(photos: RoundPhotoRef[] = [], images: { id: string; dataUrl: string }[] = []) {
  await seed(round(photos), images);
  const { container } = render(
    <ThemeProvider>
      <RoundInputScreen roster={null} roundId="r1" onBack={vi.fn()} />
    </ThemeProvider>
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /3東/ }));
  return { user, container };
}

function card(text: string): HTMLElement {
  const li = screen.getByText(text).closest('li');
  if (!li) throw new Error(`no card for ${text}`);
  return li;
}

describe('RoundInputScreen photos', () => {
  it('offers "写真を追加" only on the item marked ×', async () => {
    await openDepartment();
    expect(screen.getAllByRole('button', { name: '写真を追加' })).toHaveLength(1);
    expect(within(card(NG_ITEM)).getByRole('button', { name: '写真を追加' })).toBeInTheDocument();
    expect(within(card(OK_ITEM)).queryByRole('button', { name: '写真を追加' })).not.toBeInTheDocument();
    expect(within(card(OPEN_ITEM)).queryByRole('button', { name: '写真を追加' })).not.toBeInTheDocument();
  });

  it('shows the add button as soon as an item is marked ×', async () => {
    const { user } = await openDepartment();
    await user.click(within(screen.getByRole('group', { name: OPEN_ITEM })).getByRole('button', { name: '×' }));
    expect(within(card(OPEN_ITEM)).getByRole('button', { name: '写真を追加' })).toBeInTheDocument();
  });

  it('locks ○ / × of an item with photos and says how to unlock them', async () => {
    await openDepartment([ref('p1', '床の汚れ')], [{ id: 'p1', dataUrl: IMAGE }]);
    const locked = screen.getByRole('group', { name: NG_ITEM });
    for (const button of within(locked).getAllByRole('button')) expect(button).toBeDisabled();
    expect(locked).toHaveAccessibleDescription('写真を消すと変えられます');
    const free = screen.getByRole('group', { name: OK_ITEM });
    for (const button of within(free).getAllByRole('button')) expect(button).toBeEnabled();
    expect(screen.getAllByText('写真を消すと変えられます')).toHaveLength(1);
  });

  it('lists the photos of the item with their comments, and a frame for one that cannot be read', async () => {
    await openDepartment([ref('p1', '床の汚れ'), ref('p2')], [{ id: 'p1', dataUrl: IMAGE }]);
    const list = await screen.findByRole('list', { name: `${NG_ITEM} の写真` });
    // The images have alt="" (the comment beside them says what they show), so they have no img role.
    await waitFor(() => expect(list.querySelectorAll('img')).toHaveLength(1));
    expect(list.querySelector('img')).toHaveAttribute('src', IMAGE);
    expect(within(list).getByText('床の汚れ')).toBeInTheDocument();
    expect(within(list).getByText('写真を読めませんでした')).toBeInTheDocument();
    expect(within(list).getAllByText('2026/11/20 14:35')).toHaveLength(2);
  });

  it('asks before deleting a photo, and keeps it when cancelled', async () => {
    const { user } = await openDepartment([ref('p1')], [{ id: 'p1', dataUrl: IMAGE }]);
    const confirm = vi.spyOn(window, 'confirm');
    const deleteButton = screen.getByRole('button', { name: '写真 1 を削除' });
    await user.click(deleteButton);
    const dialog = screen.getByRole('dialog', { name: 'この写真を削除しますか？' });
    expect(within(dialog).getByRole('button', { name: 'キャンセル' })).toHaveFocus();

    await user.click(within(dialog).getByRole('button', { name: 'キャンセル' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '写真 1 を削除' })).toBeInTheDocument();
    await waitFor(() => expect(deleteButton).toHaveFocus());
    expect((await stored()).round.photos).toHaveLength(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('keeps the whole screen, header included, inert while asking, and closes with Escape', async () => {
    const { user } = await openDepartment([ref('p1')], [{ id: 'p1', dataUrl: IMAGE }]);
    const back = screen.getByRole('button', { name: '部署の一覧へ戻る' });
    expect(back.closest('[inert]')).toBeNull();
    await user.click(screen.getByRole('button', { name: '写真 1 を削除' }));
    const dialog = screen.getByRole('dialog', { name: 'この写真を削除しますか？' });
    expect(back.closest('[inert]')).not.toBeNull();
    expect(dialog.closest('[inert]')).toBeNull();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(back.closest('[inert]')).toBeNull();
    expect((await stored()).round.photos).toHaveLength(1);
  });

  it('deletes the photo once confirmed, and the marks can be changed again', async () => {
    const { user } = await openDepartment([ref('p1')], [{ id: 'p1', dataUrl: IMAGE }]);
    await user.click(screen.getByRole('button', { name: '写真 1 を削除' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '削除する' }));

    expect(screen.queryByRole('button', { name: '写真 1 を削除' })).not.toBeInTheDocument();
    for (const button of within(screen.getByRole('group', { name: NG_ITEM })).getAllByRole('button')) expect(button).toBeEnabled();
    await waitFor(async () => expect(await stored()).toEqual({ round: expect.objectContaining({ photos: [] }), images: [] }));
  });

  it('adds a photo from the add-photo screen, which names the department and item', async () => {
    const { user, container } = await openDepartment();
    await user.click(screen.getByRole('button', { name: '写真を追加' }));
    expect(screen.getByRole('heading', { name: '写真を追加' })).toHaveFocus();
    expect(screen.getByText(`3東：${NG_ITEM}`)).toBeInTheDocument();

    const gallery = container.querySelector<HTMLInputElement>('input[type="file"]:not([capture])');
    if (!gallery) throw new Error('no gallery input');
    await user.upload(gallery, new File(['x'], 'a.jpg', { type: 'image/jpeg' }));
    await user.type(screen.getByLabelText('コメント'), 'ベッド柵の汚れ');
    await user.click(await screen.findByRole('button', { name: '追加する' }));

    const list = await screen.findByRole('list', { name: `${NG_ITEM} の写真` });
    expect(within(list).getByText('ベッド柵の汚れ')).toBeInTheDocument();
    await waitFor(() => expect(list.querySelector('img')).toHaveAttribute('src', PICKED));
    await waitFor(async () => {
      const { round: saved, images } = await stored();
      expect(saved.photos).toEqual([expect.objectContaining({ department: '3東', itemId: 'a', comment: 'ベッド柵の汚れ' })]);
      expect(images).toEqual([expect.objectContaining({ id: saved.photos[0].id, dataUrl: PICKED })]);
    });
  });

  it('stays on the add-photo screen with the photo when it cannot be stored, and adds it on the next try', async () => {
    const { user, container } = await openDepartment();
    await user.click(screen.getByRole('button', { name: '写真を追加' }));
    const gallery = container.querySelector<HTMLInputElement>('input[type="file"]:not([capture])');
    if (!gallery) throw new Error('no gallery input');
    await user.upload(gallery, new File(['x'], 'a.jpg', { type: 'image/jpeg' }));

    const put = vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementationOnce(() => {
      throw new Error('boom');
    });
    await user.click(await screen.findByRole('button', { name: '追加する' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(PHOTO_SAVE_ERROR_MESSAGE);
    expect(screen.getByAltText('撮影済み')).toBeInTheDocument();
    expect((await stored()).round.photos).toEqual([]);

    put.mockRestore();
    await user.click(screen.getByRole('button', { name: '追加する' }));
    expect(await screen.findByRole('list', { name: `${NG_ITEM} の写真` })).toBeInTheDocument();
    await waitFor(async () => expect((await stored()).round.photos).toHaveLength(1));
  });

  it('goes back to the department without adding when cancelled', async () => {
    const { user } = await openDepartment();
    await user.click(screen.getByRole('button', { name: '写真を追加' }));
    await user.click(screen.getByRole('button', { name: /戻る/ }));
    expect(screen.getByRole('heading', { name: '3東' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: `${NG_ITEM} の写真` })).not.toBeInTheDocument();
  });
});
