import { useEffect, useRef, useState } from 'react'
import { ImageOrFallback } from './ImageOrFallback'
import { NoImagePlaceholder } from './NoImagePlaceholder'
import { ShopImageLightbox } from './ShopImageLightbox'
import { useSnapCarousel } from '../hooks/useSnapCarousel'

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
 * 手機與桌機共用同一條 scroll-snap 軌道（不重複 render 一份 DOM，圖片只下載一次）：
 * - 手機：直接左右滑主圖，圖下方圓點／計數
 * - 桌機：大圖左側一排直立縮圖 + hover 才出現的左右箭頭，兩者都是捲同一條軌道
 * - 兩邊都可以點圖看全螢幕大圖
 *
 * 用 object-contain 而不是 cover：商品照多為白底直立，contain 不會裁掉浮力衣下襬 / 板頭。
 */
export function ShopDetailGallery({ images, alt, resetKey }: ShopDetailGalleryProps) {
  const count = images.length
  const { trackRef, index, setIndex, handleScroll, goTo } = useSnapCarousel(count)
  const railRef = useRef<HTMLDivElement>(null)
  const [zoomOpen, setZoomOpen] = useState(false)

  useEffect(() => {
    setIndex(0)
    trackRef.current?.scrollTo({ left: 0 })
  }, [resetKey, setIndex, trackRef])

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
      <div className="relative aspect-4/5 max-h-[56vh] md:max-h-[500px] w-full max-w-[340px] sm:max-w-sm md:max-w-none mx-auto bg-gray-100 rounded-lg overflow-hidden">
        <NoImagePlaceholder />
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="md:flex md:items-start md:gap-4">
        {count > 1 && (
          <div className="hidden md:block relative shrink-0">
            <div
              ref={railRef}
              role="tablist"
              aria-label="Product images"
              className="flex flex-col gap-2 w-[68px] max-h-[500px] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
                    <img
                      src={img.url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-contain"
                    />
                  </button>
                )
              })}
            </div>
            {count > RAIL_VISIBLE && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-white to-transparent" />
            )}
          </div>
        )}

        <div className="relative group w-full max-w-[340px] sm:max-w-sm md:max-w-none mx-auto md:flex-1 md:min-w-0">
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
                className="w-full shrink-0 snap-center aspect-4/5 max-h-[56vh] md:max-h-[500px] cursor-zoom-in"
              >
                <ImageOrFallback
                  src={img.url}
                  alt={i === 0 ? alt : ''}
                  imgClassName="w-full h-full object-contain select-none"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fallback={<NoImagePlaceholder />}
                />
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
