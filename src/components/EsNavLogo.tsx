import { SHOP_NAV_LOGO_SRC } from '../lib/shopPublicUrl'

/** 與同尺寸 emoji 並排時，logo 圖檔內留白較多，略放大才視覺等高 */
export const HUB_LOGO_OPTICAL_SCALE = 1.18

/** 後台選單用的 ES 圓形 logo（對外商城捷徑） */
export function EsNavLogo({
  size = 42,
  opticalMatch = false,
}: {
  size?: number
  /** 與相鄰 emoji 同 nominal 尺寸時啟用 */
  opticalMatch?: boolean
}) {
  const px = opticalMatch ? Math.round(size * HUB_LOGO_OPTICAL_SCALE) : size
  return (
    <img
      src={SHOP_NAV_LOGO_SRC}
      alt=""
      width={px}
      height={px}
      style={{ objectFit: 'contain', display: 'block' }}
      draggable={false}
    />
  )
}
