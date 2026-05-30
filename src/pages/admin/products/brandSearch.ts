/**
 * 依品牌產生「去官網搜尋」的連結，方便上架人員找官圖。
 */
export function getBrandOfficialSearchUrl(brand: string, model: string): string | null {
  const b = brand.trim()
  const m = model.trim()
  if (!b && !m) return null

  const q = encodeURIComponent([b, m].filter(Boolean).join(' '))
  const key = b.toLowerCase()

  if (key === 'follow') {
    return `https://www.followwake.com/search?q=${encodeURIComponent(m || b)}`
  }
  if (key === 'lf' || key === 'liquid force') {
    return `https://www.liquidforce.com/search?q=${encodeURIComponent(m || b)}`
  }
  if (key === 'ronix') {
    return `https://www.ronixtools.com/search?q=${encodeURIComponent(m || b)}`
  }
  if (key === 'hyperlite') {
    return `https://www.hyperlite.com/search?q=${encodeURIComponent(m || b)}`
  }

  return `https://www.google.com/search?q=${q}`
}
