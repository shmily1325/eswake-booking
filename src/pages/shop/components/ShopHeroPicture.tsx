import { SHOP_HERO_WEBP_SRCS } from '../lib/shopHeroWebpManifest'
import { shopHeroWebpSrc } from '../lib/shopHeroUrls'
import { SHOP_HERO_IMG_VISUAL, SHOP_HERO_PICTURE_WRAP } from '../lib/shopHeroStyle'

type ShopHeroPictureProps = {
  jpgSrc: string
  layerClassName: string
  imgClassName: string
  loading?: 'eager' | 'lazy'
  fetchPriority?: 'high' | 'low' | 'auto'
  hidden?: boolean
}

export function ShopHeroPicture({
  jpgSrc,
  layerClassName,
  imgClassName,
  loading = 'lazy',
  fetchPriority,
  hidden,
}: ShopHeroPictureProps) {
  const webpSrc = shopHeroWebpSrc(jpgSrc)
  const useWebp = SHOP_HERO_WEBP_SRCS.has(webpSrc)

  return (
    <picture className={SHOP_HERO_PICTURE_WRAP + ' ' + layerClassName}>
      {useWebp ? <source srcSet={webpSrc} type="image/webp" /> : null}
      <img
        src={jpgSrc}
        alt=""
        aria-hidden={hidden}
        className={SHOP_HERO_IMG_VISUAL + ' ' + imgClassName}
        decoding="async"
        loading={loading}
        fetchPriority={fetchPriority}
      />
    </picture>
  )
}
