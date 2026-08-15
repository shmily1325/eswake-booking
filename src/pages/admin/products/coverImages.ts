/**
 * SKU 封面 gallery 共用 helper。
 * DB：product_variants.cover_images = [{ url, path }, ...]
 * [0] 與 cover_image_url / cover_image_path 同步。
 */

export const MAX_VARIANT_COVER_IMAGES = 8

export interface VariantCoverImage {
  url: string
  path: string
}

export interface DraftCoverImage extends VariantCoverImage {
  clientKey: string
}

function isCoverImage(value: unknown): value is VariantCoverImage {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return typeof row.url === 'string' && row.url.trim() !== '' && typeof row.path === 'string'
}

/** 從 DB JSONB + 舊單欄位正規化成 gallery */
export function normalizeVariantCoverImages(
  gallery: unknown,
  legacyUrl?: string | null,
  legacyPath?: string | null,
): VariantCoverImage[] {
  if (Array.isArray(gallery) && gallery.length > 0) {
    const out: VariantCoverImage[] = []
    const seen = new Set<string>()
    for (const item of gallery) {
      if (!isCoverImage(item)) continue
      const key = item.path || item.url
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ url: item.url, path: item.path })
      if (out.length >= MAX_VARIANT_COVER_IMAGES) break
    }
    if (out.length > 0) return out
  }

  const url = legacyUrl?.trim() || ''
  if (!url) return []
  return [{ url, path: legacyPath?.trim() || '' }]
}

export function draftCoverImagesFromVariant(
  gallery: unknown,
  legacyUrl?: string | null,
  legacyPath?: string | null,
  keyPrefix = 'cover',
): DraftCoverImage[] {
  return normalizeVariantCoverImages(gallery, legacyUrl, legacyPath).map((img, i) => ({
    ...img,
    clientKey: `${keyPrefix}-${i}-${img.path || img.url}`,
  }))
}

export function primaryCoverFromGallery(
  images: readonly VariantCoverImage[],
): { url: string | null; path: string | null } {
  const first = images[0]
  if (!first) return { url: null, path: null }
  return { url: first.url, path: first.path || null }
}

export function coverImagesForDb(
  images: readonly VariantCoverImage[],
): VariantCoverImage[] {
  return images
    .filter((img) => img.url.trim() !== '')
    .slice(0, MAX_VARIANT_COVER_IMAGES)
    .map((img) => ({ url: img.url, path: img.path }))
}

export function createCoverImageClientKey(): string {
  return `cover-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}
