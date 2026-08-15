import { useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSnapCarousel } from '../hooks/useSnapCarousel'

interface ShopImageLightboxProps {
  images: { url: string; label: string }[]
  startIndex: number
  alt: string
  /** 帶回關閉當下看的是第幾張，讓商品頁的 gallery 對齊 */
  onClose: (finalIndex: number) => void
}

/**
 * 全螢幕看圖。手機用同一套 scroll-snap 左右滑，桌機用箭頭 / 方向鍵。
 *
 * 走 portal 到 body：商品頁底部有 z-40 的購買列與各種 sticky，
 * 掛在原地會被關進別人的 stacking context。
 */
export function ShopImageLightbox({
  images,
  startIndex,
  alt,
  onClose,
}: ShopImageLightboxProps) {
  const count = images.length
  const { trackRef, index, handleScroll, goTo } = useSnapCarousel(count, startIndex)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  // 只認進場那一次的 startIndex：滑到一半時若被外面改動會把手指下的圖抽掉
  const openedAtRef = useRef(startIndex)

  // 開場直接跳到點進來的那張，不要讓客人看到從第一張捲過去
  useLayoutEffect(() => {
    const el = trackRef.current
    if (!el) return
    el.scrollLeft = openedAtRef.current * el.clientWidth
  }, [trackRef])

  useEffect(() => {
    closeButtonRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(index)
      else if (e.key === 'ArrowRight') goTo(index + 1)
      else if (e.key === 'ArrowLeft') goTo(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, goTo, onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-[lightboxIn_0.15s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white/80 shrink-0">
        <span className="text-xs tracking-widest uppercase tabular-nums">
          {index + 1} / {count}
        </span>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={() => onClose(index)}
          aria-label="關閉"
          className="p-2 -m-2 rounded-full hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            className="w-6 h-6"
            aria-hidden
          >
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>

      <div className="relative flex-1 min-h-0">
        <div
          ref={trackRef}
          onScroll={handleScroll}
          onClick={(e) => {
            // 點圖片以外的黑底就關掉（點圖片本身留給之後可能的縮放）
            if ((e.target as HTMLElement).tagName !== 'IMG') onClose(index)
          }}
          className="h-full flex overflow-x-auto snap-x snap-mandatory overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <div
              key={img.url}
              className="w-full h-full shrink-0 snap-center flex items-center justify-center p-4"
            >
              <img
                src={img.url}
                alt={i === index ? alt : ''}
                loading={i === startIndex ? 'eager' : 'lazy'}
                className="max-w-full max-h-full object-contain select-none"
                draggable={false}
              />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <LightboxArrow side="left" hidden={index === 0} onClick={() => goTo(index - 1)} />
            <LightboxArrow
              side="right"
              hidden={index === count - 1}
              onClick={() => goTo(index + 1)}
            />
          </>
        )}
      </div>

      {count > 1 && (
        <div className="shrink-0 flex items-center justify-center gap-1 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`第 ${i + 1} 張圖`}
              aria-current={i === index}
              className="p-1.5"
            >
              <span
                className={
                  'block h-1.5 rounded-full transition-all ' +
                  (i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/40')
                }
              />
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes lightboxIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>,
    document.body,
  )
}

function LightboxArrow({
  side,
  hidden,
  onClick,
}: {
  side: 'left' | 'right'
  hidden: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'left' ? '上一張' : '下一張'}
      className={
        'hidden md:flex absolute top-1/2 -translate-y-1/2 items-center justify-center w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors ' +
        (side === 'left' ? 'left-4' : 'right-4') +
        (hidden ? ' invisible' : '')
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-5 h-5"
        aria-hidden
      >
        {side === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  )
}
