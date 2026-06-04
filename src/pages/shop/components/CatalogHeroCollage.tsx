import { ShopHeroPanelStack } from './ShopHeroStack'
import { SHOP_HERO_IMG_BASE } from '../lib/shopHeroStyle'

interface CatalogHeroCollageProps {
  mainSrc: string
  accentSrc: string
  mainImgClass: string
  accentObjectClass: string
}

const MAIN_IMG = SHOP_HERO_IMG_BASE + ' scale-[1.06]'
const ACCENT_IMG = SHOP_HERO_IMG_BASE + ' scale-[1.08]'

export function CatalogHeroCollage({
  mainSrc,
  accentSrc,
  mainImgClass,
  accentObjectClass,
}: CatalogHeroCollageProps) {
  return (
    <div className="absolute inset-0 bg-black" aria-hidden>
      <div
        className="absolute inset-y-0 right-0 w-[48%] overflow-hidden"
        style={{ clipPath: 'polygon(18% 0, 100% 0, 100% 100%, 0 100%)' }}
      >
        <ShopHeroPanelStack
          visibleSrc={accentSrc}
          visibleClassName={ACCENT_IMG + ' ' + accentObjectClass}
        />
      </div>

      <div
        className="absolute inset-y-0 left-0 z-[1] w-[62%] overflow-hidden"
        style={{ clipPath: 'polygon(0 0, 100% 0, 80% 100%, 0 100%)' }}
      >
        <ShopHeroPanelStack
          visibleSrc={mainSrc}
          visibleClassName={MAIN_IMG + ' ' + mainImgClass}
        />
      </div>

      <div
        className="pointer-events-none absolute inset-y-0 z-[2] w-px bg-white/25"
        style={{ left: '56%', transform: 'skewX(-11deg)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-[-3%] z-[2] w-14 opacity-80"
        style={{
          left: '53%',
          transform: 'skewX(-11deg)',
          background:
            'linear-gradient(90deg, transparent, rgba(0,0,0,0.4) 45%, transparent)',
        }}
        aria-hidden
      />
    </div>
  )
}
