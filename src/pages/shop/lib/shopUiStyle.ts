/**
 * ES Wake Shop — UI 定調（列表／篩選／卡片）
 *
 * 氣質：板塊雜誌 + 街頭運動，黑底 hero、白底商品區，字重對比強。
 *
 * 文案
 * - 控制項、badge、分類：英文、短、全大寫或 Title Case，不寫教學句。
 * - 中文只用在：空狀態、錯誤、必要動作（清除篩選）、搜尋 placeholder。
 * - 不堆副標、toast、drawer 內長說明；狀態用 chips／pills／數字／選中樣式表達。
 *
 * 版面
 * - Hero：全幅意象、標題 font-black italic uppercase。
 * - 列表：灰底、圓角卡、固定品牌行＋價格區高度。
 * - 篩選：分類＝黑底 chips；品牌＝白底 chips；其餘進 Filter drawer。
 *
 * 色彩
 * - 主色 zinc-900／黑；預購 amber-600；次要 zinc-400 標籤字。
 */

/** 區塊小標（BRAND / SORT）— 僅 drawer／側欄，列表區尽量不用 */
export const SHOP_SECTION_LABEL =
  'text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400'

/** Hero 上層 group kicker */
export const SHOP_HERO_KICKER =
  'text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-white/75'
