import { SHOP_NAV_LOGO_SRC } from '../lib/shopPublicUrl'

/** 後台選單用的 ES 圓形 logo（對外商城捷徑） */
export function EsNavLogo({ size = 42 }: { size?: number }) {
  return (
    <img
      src={SHOP_NAV_LOGO_SRC}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain', display: 'block' }}
      draggable={false}
    />
  )
}
