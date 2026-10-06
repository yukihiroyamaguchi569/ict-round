// 統合報告書（Word）の表の列幅の寸法。出力（mergedDocx）と部署数の警告（mergeRounds）の両方が使う

// A4横（16838 twips）から左右余白 1440×2 を引いた本文幅
export const CONTENT_W = 13958;
/** チェック項目の文言に残す最低幅 */
export const ITEM_COL_MIN = 3000;
/** これより部署列が狭いと列見出しと評価が読み取りにくい */
const DEPT_COL_MIN = 700;
/** 部署列の幅を確保できる部署数。これを超えると表が読みにくくなるため統合ページで警告する */
export const READABLE_DEPT_MAX = Math.floor((CONTENT_W - ITEM_COL_MIN) / DEPT_COL_MIN);
