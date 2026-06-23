import type { CSSProperties } from 'react'
import { esBrandCopyright } from '../lib/esBrandTokens'

/** 對外頁面共用的版權＋副標區塊（會員專區／Shop／預約／後台） */
export function BrandCopyrightBlock({
  subtitle,
  subtitleOpacity = 0.85,
  style,
}: {
  subtitle?: string
  subtitleOpacity?: number
  style?: CSSProperties
}) {
  return (
    <div style={style}>
      {esBrandCopyright()}
      {subtitle ? (
        <div style={{ marginTop: 4, opacity: subtitleOpacity }}>{subtitle}</div>
      ) : null}
    </div>
  )
}
