import { EsNavLogo } from './EsNavLogo'

export const HEADER_NAV_ICON_SIZE = 20
export const HEADER_NAV_BUTTON_SIZE = 36

export function getHubMenuIconSize(isMobile: boolean) {
  return isMobile ? 36 : 42
}

/** Hub 卡片：emoji / logo 共用固定 bounding box */
export function HubMenuIcon({
  icon,
  iconSrc,
  isMobile,
}: {
  icon: string
  iconSrc?: string
  isMobile: boolean
}) {
  const size = getHubMenuIconSize(isMobile)
  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 5,
        flexShrink: 0,
      }}
    >
      {iconSrc ? (
        <EsNavLogo size={size} />
      ) : (
        <span style={{ fontSize: size, lineHeight: 1, display: 'block' }}>{icon}</span>
      )}
    </div>
  )
}

/** PageHeader 導覽：桌機 / 手機共用 icon 尺寸 */
export function HeaderNavIcon({
  iconSrc,
  emoji,
}: {
  iconSrc?: string
  emoji?: string
}) {
  return (
    <span
      style={{
        width: HEADER_NAV_ICON_SIZE,
        height: HEADER_NAV_ICON_SIZE,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: HEADER_NAV_ICON_SIZE,
        lineHeight: 1,
      }}
    >
      {iconSrc ? <EsNavLogo size={HEADER_NAV_ICON_SIZE} /> : emoji}
    </span>
  )
}
