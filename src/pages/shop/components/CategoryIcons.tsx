/**
 * 分類 icon 庫（inline SVG）。
 *
 * 設計原則：
 * - 統一風格：fill="none" + stroke="currentColor" + strokeWidth 1.5，
 *   呼叫端用 `text-*` / `opacity-*` 控色，不寫死黑或灰
 * - 24×24 viewBox（lucide-style）：用 size 12-200px 都銳利
 * - 線條風（line art），不填色，符合 Ronix 黑白 monochrome 精神
 *
 * 用在：
 * - ShopList hero：當客人篩到某個 sub-cat 時，hero 角落顯示對應 icon
 *   （ES 的 signature touch，不放在 tab 內避免視覺過載）
 * - 未來可能：Shop by Category block / 後台 admin
 *
 * 還沒實作的分類會回 null，hero 那邊用 null check 不渲染 icon。
 * 等收到 user 對 Board / Boots 兩個樣品的回饋再決定要不要把剩下 8 個補完。
 */

import type { ReactElement, SVGProps } from 'react'

/**
 * 通用 props：傳 className 進來改色 / 大小（text-white/30、w-20 h-20 等）。
 * extends SVGProps 是為了 forward `aria-label` 等 a11y 屬性。
 */
type IconProps = SVGProps<SVGSVGElement>

const baseSvgProps: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

/**
 * Wakeboard 板（俯視圖，twin-tip 對稱長板）。
 * 路徑用 Q 貝茲畫出微微 hourglass 外型：兩端略窄、中間略寬，
 * 像真實 wakeboard 的 outline，比純橢圓更有「板」的辨識度。
 * 兩個小圓表示 binding 鎖點。
 */
export function WakeboardIcon(props: IconProps) {
  return (
    <svg {...baseSvgProps} {...props}>
      <path d="M12 2 Q8 3 8 8 Q7 12 8 16 Q8 21 12 22 Q16 21 16 16 Q17 12 16 8 Q16 3 12 2 Z" />
      <circle cx="12" cy="9" r="0.9" />
      <circle cx="12" cy="15" r="0.9" />
    </svg>
  )
}

/**
 * Wakeboard boots（正面，pair view）。
 * 兩隻併排呈現「複數」語意；每隻是高筒輪廓 + 底板，沒畫鞋帶 / BOA 旋鈕
 * 等細節是因為在 hero 大圖時細節會雜，目前先保持極簡。
 */
export function BootsIcon(props: IconProps) {
  return (
    <svg {...baseSvgProps} {...props}>
      {/* 左腳 */}
      <path d="M5 4 H10 V14 L11.5 16 V19 H3.5 V16 L5 14 Z" />
      {/* 右腳 */}
      <path d="M14 4 H19 V14 L20.5 16 V19 H12.5 V16 L14 14 Z" />
      {/* 鞋面分隔線（暗示腳踝彎折） */}
      <line x1="5" y1="10" x2="10" y2="10" />
      <line x1="14" y1="10" x2="19" y2="10" />
    </svg>
  )
}

/**
 * categoryId → 對應 icon component。
 * 還沒實作的回 null。
 *
 * 注意：wb_board 跟 ws_board 兩個 category id 都是 wakeboard 形狀，
 *   但 ws_board 之後應該換成短一點的 pintail surf board 形狀。
 *   目前先共用 WakeboardIcon。
 */
export function getCategoryIconComponent(
  categoryId: string | null | undefined
): ((props: IconProps) => ReactElement) | null {
  if (!categoryId) return null
  switch (categoryId) {
    case 'wb_board':
    case 'ws_board':
      return WakeboardIcon
    case 'wb_boots':
      return BootsIcon
    // TODO（看完樣品再決定要不要補）：
    //   wb_fin / ws_fin → FinIcon
    //   wb_handle / ws_handle → RopeHandleIcon
    //   wb_helmet → HelmetIcon
    //   ws_pad → TractionPadIcon
    //   ws_wax → WaxIcon
    //   lifejacket → ImpactVestIcon
    //   wetsuit → WetsuitIcon
    //   apparel → ApparelIcon
    default:
      return null
  }
}
