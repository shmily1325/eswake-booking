import { useEffect, useState, type ImgHTMLAttributes } from 'react'
import {
  isShopHeroImageReady,
  preloadShopHeroImage,
} from '../lib/shopHeroPreload'

type ShopHeroPictureProps = Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'loading' | 'decoding' | 'fetchPriority'
> & {
  src: string
}

/**
 * 等圖進快取／解碼後再換 src，避免分類切換時 hero 晚於標題出現。
 */
export function ShopHeroPicture({
  src,
  className,
  alt = '',
  ...rest
}: ShopHeroPictureProps) {
  const [displaySrc, setDisplaySrc] = useState(src)

  useEffect(() => {
    if (src === displaySrc) return
    let cancelled = false

    if (isShopHeroImageReady(src)) {
      setDisplaySrc(src)
      return
    }

    void preloadShopHeroImage(src).then(() => {
      if (!cancelled) setDisplaySrc(src)
    })

    return () => {
      cancelled = true
    }
  }, [src, displaySrc])

  return (
    <img
      {...rest}
      src={displaySrc}
      alt={alt}
      className={className}
      decoding="async"
      loading="eager"
      fetchPriority="high"
    />
  )
}
