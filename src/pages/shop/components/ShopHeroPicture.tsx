import { SHOP_HERO_WEBP_SRCS } from '../lib/shopHeroWebpManifest'
import { shopHeroWebpSrc } from '../lib/shopHeroUrls'

type ShopHeroPictureProps = {
  jpgSrc: string
  className: string
  loading?: 'eager' | 'lazy'
  fetchPriority?: 'high' | 'low' | 'auto'
  hidden?: boolean
}

export function ShopHeroPicture({
  jpgSrc,
  className,
  loading = 'lazy',
  fetchPriority,
  hidden,
}: ShopHeroPictureProps) {
  const webpSrc = shopHeroWebpSrc(jpgSrc)
  const useWebp = SHOP_HERO_WEBP_SRCS.has(webpSrc)

  return (
    <picture className="absolute inset-0 block h-full w-full">
      {useWebp ? (
        <source srcSet={webpSrc} type="image/webp" />
      ) : null}
      <img
        src={jpgSrc}
        alt=""
        aria-hidden={hidden}
        className={className}
        decoding="async"
        loading={loading}
        fetchPriority={fetchPriority}
      />
    </picture>
  )
}
