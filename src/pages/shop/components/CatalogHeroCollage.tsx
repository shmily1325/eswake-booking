/** 桌機 Catalog：左大圖 + 右側斜切副圖（編輯式拼貼） */
interface CatalogHeroCollageProps {
  mainSrc: string
  accentSrc: string
  mainImgClass: string
  accentObjectClass: string
}

const IMG_BASE =
  'absolute inset-0 h-full w-full object-cover contrast-[1.05] saturate-[1.03]'

/** 右側底層（#3 船側面）— 略放大、稍暗，當背景層 */
const ACCENT_IMG = IMG_BASE + ' scale-[1.18] brightness-[0.92]'

/** 左側主圖（#8）— 焦點在船與人 */
const MAIN_IMG = IMG_BASE + ' scale-[1.1]'

/**
 * 主圖約 68% 寬、斜切露出右條；
 * 副圖疊在右側 40% 區，斜向與主圖交錯，中間漸層銜接（非硬黑線）。
 */
export function CatalogHeroCollage({
  mainSrc,
  accentSrc,
  mainImgClass,
  accentObjectClass,
}: CatalogHeroCollageProps) {
  return (
    <div className="absolute inset-0 bg-black" aria-hidden>
      {/* 右：副圖底層 */}
      <div
        className="absolute inset-y-0 right-0 w-[44%] overflow-hidden"
        style={{ clipPath: 'polygon(18% 0, 100% 0, 100% 100%, 0 100%)' }}
      >
        <img
          src={accentSrc}
          alt=""
          className={ACCENT_IMG + ' ' + accentObjectClass}
          decoding="async"
          loading="lazy"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/25 via-transparent to-black/10"
          aria-hidden
        />
      </div>

      {/* 左：主圖前景 */}
      <div
        className="absolute inset-0 z-[1] overflow-hidden"
        style={{ clipPath: 'polygon(0 0, 100% 0, 78% 100%, 0 100%)' }}
      >
        <img
          src={mainSrc}
          alt=""
          className={MAIN_IMG + ' ' + mainImgClass}
          decoding="async"
          fetchPriority="high"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg, transparent 52%, rgba(0,0,0,0.4) 68%, rgba(0,0,0,0.12) 82%, transparent 100%)',
          }}
          aria-hidden
        />
      </div>

      {/* 斜切縫：細白線 + 柔邊，取代粗黑條 */}
      <div
        className="pointer-events-none absolute inset-y-0 z-[2] w-[3px] bg-white/20 mix-blend-overlay"
        style={{ left: '62%', transform: 'skewX(-11deg)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-[-4%] z-[2] w-16"
        style={{
          left: '58%',
          transform: 'skewX(-11deg)',
          background:
            'linear-gradient(90deg, transparent, rgba(0,0,0,0.55) 35%, rgba(0,0,0,0.25) 65%, transparent)',
        }}
        aria-hidden
      />
    </div>
  )
}
