import { useEffect, useState } from 'react'

interface ImageOrFallbackProps {
  /** 圖片網址；null / undefined / 載入失敗都會 fallback */
  src: string | null | undefined
  alt: string
  /** 圖片成功時套用的 className（通常是 `w-full h-full object-cover`） */
  imgClassName?: string
  /** 沒圖或載入失敗時顯示的內容（通常是包裹好的 emoji 元素） */
  fallback: React.ReactNode
  loading?: 'lazy' | 'eager'
}

/**
 * 小元件：有圖載圖、失敗或無 URL 退回 fallback。
 *
 * 為什麼存在：避免 image_url 失效（404 / CORS / 主機掛掉）時整個商城都長破圖。
 * 三處（ProductCard、ShopDetail、ShopCart）共用，容器尺寸由呼叫端決定。
 */
export function ImageOrFallback({
  src,
  alt,
  imgClassName,
  fallback,
  loading = 'lazy',
}: ImageOrFallbackProps) {
  const [errored, setErrored] = useState(false)

  // src 改變時重置錯誤狀態（例如切換變體圖片，本來壞掉的不影響新圖）
  useEffect(() => {
    setErrored(false)
  }, [src])

  if (!src || errored) return <>{fallback}</>

  return (
    <img
      src={src}
      alt={alt}
      className={imgClassName}
      loading={loading}
      onError={() => setErrored(true)}
    />
  )
}
