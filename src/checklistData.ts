import type { ChecklistItemDef } from './types';

export interface ChecklistCategory {
  category: string;
  items: ChecklistItemDef[];
}

export const CHECKLIST_CATEGORIES: ChecklistCategory[] = [
  {
    category: '手指衛生',
    items: [
      {
        id: 'hand-hygiene-1',
        category: '手指衛生',
        description: '病室の入退室時に手指衛生が行えている．',
      },
      {
        id: 'hand-hygiene-2',
        category: '手指衛生',
        description: '手指衛生剤に開封日の記載がある．年度も記載している．月1回残量確認実施している.',
      },
    ],
  },
  {
    category: '水回り',
    items: [
      {
        id: 'water-1',
        category: '水回り',
        description: '洗浄用スポンジは乾燥し易い様に保管．原則タワシはNG．（交換目安：2週間毎）',
      },
      {
        id: 'water-2',
        category: '水回り',
        description: 'シンク回りに氷枕などが掛かっていない．（水跳ねしない場所で管理）',
      },
      {
        id: 'water-3',
        category: '水回り',
        description: 'シンクは定期的に清掃され、周辺に水はねがなく、清潔に保たれている．',
      },
    ],
  },
  {
    category: '薬品',
    items: [
      {
        id: 'medicine-1',
        category: '薬品',
        description: '薬品保冷庫内は整理整頓され、清掃が行き届いている．',
      },
      {
        id: 'medicine-2',
        category: '薬品',
        description: '薬品や消毒薬は、開封日の記載があり、期限切れがない．',
      },
    ],
  },
  {
    category: 'リネン等',
    items: [
      {
        id: 'linen-1',
        category: 'リネン等',
        description: '清潔リネンは汚染しないよう保管されている．',
      },
      {
        id: 'linen-2',
        category: 'リネン等',
        description: '医療廃棄物の分別・表示が適切で遵守されている．',
      },
    ],
  },
  {
    category: '処置室',
    items: [
      {
        id: 'treatment-1',
        category: '処置室',
        description: '清潔物品と不潔物品が混在せず、区別して配置している．物品は清潔に保管している．',
      },
      {
        id: 'treatment-2',
        category: '処置室',
        description: '包交車に搭載する物品は最小限（目安は１日分）とし清潔と不潔区域を区別している．',
      },
      {
        id: 'treatment-3',
        category: '処置室',
        description: '検体保管・運搬容器に破損や汚染がない．',
      },
    ],
  },
  {
    category: 'PPE',
    items: [
      {
        id: 'ppe-1',
        category: 'PPE',
        description: 'PPE（個人防護具）がすぐに使用できるよう適切な場所に設置されている．',
      },
      {
        id: 'ppe-2',
        category: 'PPE',
        description: '経路別予防策に応じた必要なPPEが患者の部屋に設置されており、使用している．',
      },
      {
        id: 'ppe-3',
        category: 'PPE',
        description: 'PPEを着たまま廊下を歩いているスタッフがいない．（排液時のみ可）',
      },
    ],
  },
  {
    category: '日常清掃',
    items: [
      {
        id: 'cleaning-1',
        category: '日常清掃',
        description: 'パソコン、ナースコール等、高頻度接触面に汚れや埃がない．',
      },
      {
        id: 'cleaning-2',
        category: '日常清掃',
        description: '浴室の清掃がいきわたり、カビの繁殖がない．',
      },
    ],
  },
  {
    category: 'デバイス関連',
    items: [
      {
        id: 'device-1',
        category: 'デバイス関連',
        description: '膀胱留置カテーテルが屈曲していない．床についていない．',
      },
      {
        id: 'device-2',
        category: 'デバイス関連',
        description: '点滴ルートが床についていない．',
      },
    ],
  },
  {
    category: '汚物室・トイレ',
    items: [
      {
        id: 'toilet-1',
        category: '汚物室・トイレ',
        description: '汚物処理室の清潔が保たれている．',
      },
      {
        id: 'toilet-2',
        category: '汚物室・トイレ',
        description: 'エリアが清潔・不潔と区別されている．手洗いシンクに不潔物を置かない．',
      },
      {
        id: 'toilet-3',
        category: '汚物室・トイレ',
        description: 'トイレットペーパーなど無駄なストックが置かれていない．',
      },
    ],
  },
];

export const ALL_ITEMS: ChecklistItemDef[] = CHECKLIST_CATEGORIES.flatMap((cat) => cat.items);

export const TOTAL_ITEMS = ALL_ITEMS.length;

export function getItemById(id: string): ChecklistItemDef | undefined {
  return ALL_ITEMS.find((item) => item.id === id);
}
