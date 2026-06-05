/** 列表 hero：同名 .webp（由 tools/optimize-shop-heroes.mjs 產生） */
export function shopHeroWebpSrc(jpgSrc: string): string {
  return jpgSrc.replace(/\.jpe?g$/i, '.webp')
}
