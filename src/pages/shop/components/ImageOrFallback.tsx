import { useEffect, useRef, useState, type RefObject } from 'react'

interface ImageOrFallbackProps {
  /** 圖片網址；null / undefined / 載入失敗都會 fallback */
  src: string | null | undefined
  alt: string
  /** 圖片成功時套用的 className（商品照通常是 object-contain） */
  imgClassName?: string
  /** 沒圖或載入失敗時顯示的內容 */
  fallback: React.ReactNode
  loading?: 'lazy' | 'eager'
  /**
   * 橫滑 carousel 的 scroll 容器。有傳時等進入軌道附近才設 src。
   * 原生 loading=lazy 對橫滑幾乎無效（圖都在視窗垂直範圍內，會一次全抓）。
   */
  observeRoot?: RefObject<Element | null>
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
  observeRoot,
}: ImageOrFallbackProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [errored, setErrored] = useState(false)
  const [inView, setInView] = useState(loading === 'eager' || !observeRoot)

  useEffect(() => {
    setErrored(false)
  }, [src])

  useEffect(() => {
    if (inView || !observeRoot) return
    const el = wrapRef.current
    if (!el) return

    let io: IntersectionObserver | null = null
    let cancelled = false
    let raf = 0

    const start = () => {
      const root = observeRoot.current
      if (!root) {
        raf = requestAnimationFrame(start)
        return
      }
      if (cancelled) return
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setInView(true)
        },
        {
          root,
          rootMargin: '0px 50% 0px 50%',
          threshold: 0.01,
        },
      )
      io.observe(el)
    }

    start()
    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      io?.disconnect()
    }
  }, [inView, observeRoot])

  if (!src || errored) return <>{fallback}</>

  if (!inView) {
    return <div ref={wrapRef} className={imgClassName} aria-hidden />
  }

  return (
    <img
      src={src}
      alt={alt}
      className={imgClassName}
      loading={loading}
      decoding="async"
      draggable={false}
      fetchPriority={loading === 'eager' ? 'high' : 'auto'}
      onError={() => setErrored(true)}
    />
  )
}
