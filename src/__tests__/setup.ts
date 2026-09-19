import { beforeEach } from 'vitest';

// environment: 'node' には localStorage が存在しないため、
// checklistStorage.ts のテスト用に最小限のインメモリ実装を割り当てる。
const store = new Map<string, string>();

// store はモジュールスコープで共有されるため、テスト間で持ち越さないよう毎回空にする。
beforeEach(() => {
  store.clear();
});

globalThis.localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    store.set(key, String(value));
  },
  removeItem: (key: string) => {
    store.delete(key);
  },
  clear: () => {
    store.clear();
  },
  key: (index: number) => [...store.keys()][index] ?? null,
  get length() {
    return store.size;
  },
} as Storage;
