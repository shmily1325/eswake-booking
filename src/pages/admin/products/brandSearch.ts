/**
 * 依品牌／貨號產生「去官網搜尋」的連結，方便上架人員找官圖。
 */
export interface ProductImageSearchLink {
  label: string
  url: string
}

export function getProductImageSearchLinks(
  brand: string,
  model: string,
  vendorCode?: string | null,
): ProductImageSearchLink[] {
  const b = brand.trim()
  const m = model.trim()
  const vc = vendorCode?.trim() ?? ''
  const key = b.toLowerCase()
  const links: ProductImageSearchLink[] = []

  if (key === 'follow') {
    links.push({
      label: `Follow 官網搜「${m || b}」`,
      url: `https://www.followwake.com/search?q=${encodeURIComponent(m || b)}`,
    })
  } else if (key === 'lf' || key === 'liquid force') {
    links.push({
      label: `Liquid Force 官網搜「${m || b}」`,
      url: `https://www.liquidforce.com/search?q=${encodeURIComponent(m || b)}`,
    })
  } else if (key === 'ronix') {
    links.push({
      label: `Ronix 官網搜「${m || b}」`,
      url: `https://www.ronixtools.com/search?q=${encodeURIComponent(m || b)}`,
    })
  } else if (key === 'hyperlite') {
    links.push({
      label: `Hyperlite 官網搜「${m || b}」`,
      url: `https://www.hyperlite.com/search?q=${encodeURIComponent(m || b)}`,
    })
  }

  if (vc) {
    links.push({
      label: `海芒果搜貨號「${vc}」`,
      url: `https://www.google.com/search?q=${encodeURIComponent(`site:shop.ocean-mango.com ${vc}`)}`,
    })
  }

  if (links.length === 0 && (b || m)) {
    links.push({
      label: `Google 搜「${b} ${m}」`.trim(),
      url: `https://www.google.com/search?q=${encodeURIComponent([b, m].filter(Boolean).join(' '))}`,
    })
  }

  return links
}

/** @deprecated 請改用 getProductImageSearchLinks */
export function getBrandOfficialSearchUrl(brand: string, model: string): string | null {
  return getProductImageSearchLinks(brand, model)[0]?.url ?? null
}
