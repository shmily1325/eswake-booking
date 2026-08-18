import { useEffect, useRef, useState } from 'react'
import { ImageOrFallback } from './ImageOrFallback'
import { NoImagePlaceholder } from './NoImagePlaceholder'
import { ShopImageLightbox } from './ShopImageLightbox'
import { useSnapCarousel } from '../hooks/useSnapCarousel'
import { SHOP_DETAIL_FRAME, SHOP_DETAIL_WRAP } from '../lib/shopUiStyle'

export interface GalleryImage {
  url: string
  /** 只給 aria-label / alt 用，不在畫面上印出來 */
  label: string
}

interface ShopDetailGalleryProps {
  images: GalleryImage[]
  alt: string
  /** 這個值變了就捲回第一張（換 SKU / 換商品） */
  resetKey: string
}

/** 超過這個數量就不畫圓點，改用「3 / 12」計數，避免手機一排點點糊成一片 */
const MAX_DOTS = 8
/** 直立縮圖列一次放得下的張數；超過就出現底部漸層提示可以往下捲 */
const RAIL_VISIBLE = 5

/**
 * 商品詳情主圖 gallery。
 *
 * 主圖一次只下載眼前與相鄰張；其餘滑到再載，避免多圖商品開頁等很久。
 * - 手機：直接左右滑主圖，圖下方圓點／計數
 * - 桌機：大圖左側一排直立縮圖 + hover 才出現的左右箭頭，兩者都是捲同一條軌道
 * - 兩邊都可以點圖看全螢幕大圖
 *
 * 用 object-contain 而不是 cover：商品照多為白底直立，contain 不會裁掉浮力衣下襬 / 板頭。
 */
function useDesktopRail() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const update = () => setShow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return show
}

function neighborsOf(index: number, count: number): number[] {
  const out: number[] = []
  for (const i of [index - 1, index, index + 1]) {
    if (i >= 0 && i < count) out.push(i)
  }
  return out
}

export function ShopDetailGallery({ images, alt, resetKey }: ShopDetailGalleryProps) {
  const count = images.length
  const { trackRef, index, setIndex, handleScroll, goTo } = useSnapCarousel(count)
  const railRef = useRef<HTMLDivElement>(null)
  const [zoomOpen, setZoomOpen] = useState(false)
  const showRail = useDesktopRail()
  const [armed, setArmed] = useState(() => new Set(neighborsOf(0, count)))

  useEffect(() => {
    setIndex(0)
    setArmed(new Set(neighborsOf(0, count)))
    trackRef.current?.scrollTo({ left: 0 })
  }, [resetKey, count, setIndex, trackRef])

  useEffect(() => {
    setArmed((prev) => {
      const next = new Set(prev)
      for (const i of neighborsOf(index, count)) next.add(i)
      return next
    })
  }, [index, count])

  // 縮圖列比大圖矮，用箭頭 / 滑動換圖時要把選中的縮圖帶進視野。
  // 手動算 scrollTop 而不用 scrollIntoView：後者會連整頁一起捲。
  useEffect(() => {
    const rail = railRef.current
    const active = rail?.children[index] as HTMLElement | undefined
    if (!rail || !active) return
    const top = active.offsetTop
    const bottom = top + active.offsetHeight
    if (top < rail.scrollTop) {
      rail.scrollTo({ top, behavior: 'smooth' })
    } else if (bottom > rail.scrollTop + rail.clientHeight) {
      rail.scrollTo({ top: bottom - rail.clientHeight, behavior: 'smooth' })
    }
  }, [index])

  if (count === 0) {
    return (
      <div className={'relative mx-auto md:mx-0 max-w-[280px] sm:max-w-[320px] md:max-w-[400px] bg-gray-100 rounded-lg overflow-hidden ' + SHOP_DETAIL_FRAME}>
        <NoImagePlaceholder />
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="md:flex md:items-start md:gap-4">
        {showRail && count > 1 && (
          <div className="relative shrink-0">
            <div
              ref={railRef}
              role="tablist"
              aria-label="Product images"
              className="flex flex-col gap-2 w-[68px] max-h-[420px] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {images.map((img, i) => {
                const active = i === index
                return (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => goTo(i)}
                    role="tab"
                    aria-selected={active}
                    aria-label={img.label}
                    className={
                      'shrink-0 w-[68px] h-[85px] rounded-md overflow-hidden bg-white border transition-colors ' +
                      (active
                        ? 'border-zinc-900'
                        : 'border-gray-200 hover:border-gray-400 opacity-70 hover:opacity-100')
                    }
                  >
                    {armed.has(i) ? (
                      <img
                        src={img.url}
                        alt=""
                        decoding="async"
                        className="w-full h-full object-contain"
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>
            {count > RAIL_VISIBLE && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-white to-transparent" />
            )}
          </div>
        )}

        <div className={SHOP_DETAIL_WRAP}>
          <div
            ref={trackRef}
            onScroll={handleScroll}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' && index < count - 1) {
                e.preventDefault()
                goTo(index + 1)
              } else if (e.key === 'ArrowLeft' && index > 0) {
                e.preventDefault()
                goTo(index - 1)
              }
            }}
            tabIndex={count > 1 ? 0 : -1}
            role="group"
            aria-roledescription="carousel"
            aria-label={alt}
            className="flex overflow-x-auto snap-x snap-mandatory rounded-lg bg-white border border-gray-100 overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
          >
            {images.map((img, i) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setZoomOpen(true)}
                aria-label={`放大檢視 ${img.label}`}
                tabIndex={-1}
                className={'w-full shrink-0 snap-center cursor-zoom-in ' + SHOP_DETAIL_FRAME}
              >
                {armed.has(i) ? (
                  <ImageOrFallback
                    src={img.url}
                    alt={i === index ? alt : ''}
                    imgClassName="w-full h-full object-contain select-none"
                    loading={i === index ? 'eager' : 'lazy'}
                    fallback={<NoImagePlaceholder />}
                  />
                ) : (
                  <div className="w-full h-full bg-white" aria-hidden />
                )}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            aria-label="放大檢視商品圖"
            className="hidden md:flex absolute bottom-3 right-3 items-center justify-center w-9 h-9 rounded-full bg-white/90 shadow-sm text-zinc-700 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          >
            <ZoomIcon />
          </button>

          {count > 1 && (
            <>
              <ArrowButton side="left" disabled={index === 0} onClick={() => goTo(index - 1)} />
              <ArrowButton
                side="right"
                disabled={index === count - 1}
                onClick={() => goTo(index + 1)}
              />
            </>
          )}
        </div>
      </div>

      {/*
        手機的頁碼放在圖下方而不是疊在圖上：商品照常常整張撐滿，
        疊上去會壓到浮力衣下襬。圓點外面包 p-1.5 是為了湊到可點的大小。
      */}
      {count > 1 && (
        <div className="md:hidden mt-1 flex items-center justify-center">
          {count <= MAX_DOTS ? (
            <div className="flex items-center">
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
                      (i === index ? 'w-5 bg-zinc-900' : 'w-1.5 bg-zinc-300')
                    }
                  />
                </button>
              ))}
            </div>
          ) : (
            <span className="py-1 text-xs text-gray-500 tabular-nums">
              {index + 1} / {count}
            </span>
          )}
        </div>
      )}

      {zoomOpen && (
        <ShopImageLightbox
          images={images}
          startIndex={index}
          alt={alt}
          onClose={(finalIndex) => {
            setZoomOpen(false)
            goTo(finalIndex, 'auto')
          }}
        />
      )}
    </div>
  )
}

function ArrowButton({
  side,
  disabled,
  onClick,
}: {
  side: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === 'left' ? '上一張' : '下一張'}
      className={
        'hidden md:flex absolute top-1/2 -translate-y-1/2 items-center justify-center w-9 h-9 rounded-full bg-white/90 shadow-sm text-zinc-800 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity disabled:opacity-0 disabled:pointer-events-none ' +
        (side === 'left' ? 'left-2' : 'right-2')
      }
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
        aria-hidden
      >
        {side === 'left' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  )
}

function ZoomIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  )
}
