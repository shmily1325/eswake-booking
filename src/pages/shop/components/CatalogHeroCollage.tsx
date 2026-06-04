/** 桌機 Catalog：主圖 + 右上斜切一張副圖（手機不用） */
interface CatalogHeroCollageProps {
  mainSrc: string
  accentSrc: string
  mainImgClass: string
  accentObjectClass: string
}

const PANEL_IMG =
  'absolute inset-0 h-full w-full object-cover contrast-[1.06] saturate-[1.04] scale-[1.12]'

/** 主圖左側大區；副圖右上斜切 */
export function CatalogHeroCollage({
  mainSrc,
  accentSrc,
  mainImgClass,
  accentObjectClass,
}: CatalogHeroCollageProps) {
  return (
    <div className="absolute inset-0" aria-hidden>
      <div
        className="absolute inset-y-0 left-0 w-[74%] overflow-hidden"
        style={{ clipPath: 'polygon(0 0, 100% 0, 86% 100%, 0 100%)' }}
      >
        <img
          src={mainSrc}
          alt=""
          className={PANEL_IMG + ' ' + mainImgClass}
          decoding="async"
          fetchPriority="high"
        />
      </div>

      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: 'polygon(66% 0, 100% 0, 100% 100%, 56% 100%)' }}
      >
        <img
          src={accentSrc}
          alt=""
          className={PANEL_IMG + ' ' + accentObjectClass}
          decoding="async"
          loading="lazy"
        />
      </div>

      <div
        className="pointer-events-none absolute top-[-2%] bottom-[-2%] z-[2] w-[4px] bg-black"
        style={{ left: '64.5%', transform: 'skewX(-9deg)' }}
        aria-hidden
      />
    </div>
  )
}
