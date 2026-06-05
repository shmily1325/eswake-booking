/**
 * ES Wake Shop — 介面定調
 *
 * 一句話：簡單、乾淨、清爽、好用，帶一點運動雜誌的態度。
 * 不需要的不加；能用狀態表達的就不寫字。
 *
 * ── 簡單 Simple ──
 * - 一頁只做一件事：列表＝逛商品；篩選收在少數入口（分類 chips + Filter）。
 * - 手機不並排兩套同功能（搜尋只在 header、品牌只在 Filter drawer）。
 * - 元件少層級：hero → 分類 → 列表，中間不插教學區塊。
 *
 * ── 乾淨 Clean ──
 * - 白底商品區 + 黑底 hero，中間不要第三種底色。
 * - 灰字只用在次要資訊（件數、品牌名）；標題與價格用 zinc-900。
 * - 已選條件用 pills 或 chips 呈現，用完即走，不常駐說明文字。
 *
 * ── 清爽 Fresh ──
 * - 留白夠：卡片間距、列表上下 padding，不擠滿螢幕。
 * - 互動輕：hover／active 用 border 或底色變化，少陰影、少動畫。
 * - 圖片為主角；UI 不搶過商品照與 hero 意象。
 *
 * ── 好用 Usable ──
 * - 拇指區：chip、Filter、卡片可點區 ≥ 44px 高。
 * - 篩選會反映在 URL，返回上一頁保留狀態。
 * - 空結果給一個動作（清除篩選），不堆原因說明。
 *
 * ── 有風格 Character ──
 * - 字：標題／logo 區 font-black italic uppercase；內文正常 sans。
 * - 色：黑 + 白 + zinc；預購 amber-600；避免再引入新主色。
 * - 圖：hero 全幅裁切一致；商品卡固定版型（品牌行 + 型號 + 價格高）。
 *
 * ── 文案 ──
 * - 按鈕、badge、分類 tab：英文、短。
 * - 中文：搜尋 placeholder、空狀態、錯誤、清除篩選、drawer 底部「顯示 N 件」。
 * - 禁止：副標、toast 教學、drawer 內長段落、hero 重複搜尋／預購說明。
 *
 * ── 資訊架構（固定，勿再加第四條導覽）──
 * | 層級     | 手機              | 桌機        |
 * |----------|-------------------|-------------|
 * | 分類     | hero 下黑底 chips | 同左 + 側欄 |
 * | 品牌等   | Filter drawer     | 側欄        |
 * | 搜尋     | header 一處       | header      |
 *
 * ── 新增功能前自問 ──
 * 1. 拿掉它，使用者還完成得了任務嗎？能 → 不加。
 * 2. 能用現有 chip／pill／角標表達嗎？能 → 不加新文案。
 * 3. 會不會跟現有入口重複？會 → 合併，不並列。
 */

/** drawer／側欄區塊小標（列表主區不用） */
export const SHOP_SECTION_LABEL =
  'text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400'

/** Hero 父分類 kicker */
export const SHOP_HERO_KICKER =
  'text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-white/75'
