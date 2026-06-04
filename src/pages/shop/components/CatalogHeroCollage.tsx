import { ShopHeroPicture } from './ShopHeroPicture'

/** 桌機 Catalog：左右雙欄（兩張獨立照片，不假裝同一場景） */
interface CatalogHeroCollageProps {
  mainSrc: string
  accentSrc: string
  mainImgClass: string
  accentObjectClass: string
}

const IMG_BASE =
  'absolute inset-0 h-full w-full object-cover contrast-[1.05] saturate-[1.03]'

const MAIN_IMG = IMG_BASE + ' scale-[1.05]'
const ACCENT_IMG = IMG_BASE + ' scale-[1.06]'

/**
 * 58 / 42 直向分欄 + 細分隔線。
 * 不用斜切重疊，避免左圖蓋住右欄、或兩張船照地平線對不起來。
 */
export function CatalogHeroCollage({
  mainSrc,
  accentSrc,
  mainImgClass,
  accentObjectClass,
}: CatalogHeroCollageProps) {
  return (
    <div className="absolute inset-0 flex bg-black" aria-hidden>
      <div className="relative h-full w-[58%] shrink-0 overflow-hidden">
        <ShopHeroPicture
          src={mainSrc}
          alt=""
          className={MAIN_IMG + ' ' + mainImgClass}
        />
      </div>

      <div className="w-px shrink-0 bg-white/12" aria-hidden />

      <div className="relative h-full min-w-0 flex-1 overflow-hidden">
        <ShopHeroPicture
          src={accentSrc}
          alt=""
          className={ACCENT_IMG + ' ' + accentObjectClass}
        />
      </div>
    </div>
  )
}
