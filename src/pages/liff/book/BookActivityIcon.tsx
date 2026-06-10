import type { CSSProperties } from 'react'
import type { ActivityCode } from './types'

const THUMB_BY_CODE: Record<ActivityCode, { src: string; src2x: string }> = {
  WS: { src: '/liff/book/ws-thumb.webp', src2x: '/liff/book/ws-thumb@2x.webp' },
  WB: { src: '/liff/book/wb-thumb.webp', src2x: '/liff/book/wb-thumb@2x.webp' },
}

interface BookActivityIconProps {
  code: ActivityCode
  size?: number
  style?: CSSProperties
}

export function BookActivityIcon({ code, size = 64, style }: BookActivityIconProps) {
  const thumb = THUMB_BY_CODE[code]
  return (
    <img
      src={thumb.src}
      srcSet={`${thumb.src} 1x, ${thumb.src2x} 2x`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      style={{
        display: 'block',
        objectFit: 'contain',
        ...style,
      }}
    />
  )
}

interface BookBothIconsProps {
  size?: number
  gap?: number
  style?: CSSProperties
}

/** 混合梯次：並排顯示兩項 icon */
export function BookBothIcons({ size = 40, gap = 6, style }: BookBothIconsProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap, ...style }}>
      <BookActivityIcon code="WS" size={size} />
      <BookActivityIcon code="WB" size={size} />
    </div>
  )
}
