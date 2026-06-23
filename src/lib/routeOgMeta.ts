import { ES_BRAND, esBrandPageTitle } from './esBrandTokens'

export interface RouteOgMeta {
  title: string
  description: string
  /** 相對於 site origin，預設 /logo.png */
  image?: string
  imageType?: string
}

/** 依路徑的 Open Graph（LINE / Facebook 分享預覽） */
export const ROUTE_OG_BY_PATH: Record<string, RouteOgMeta> = {
  '/liff': {
    title: esBrandPageTitle(ES_BRAND.memberAreaLabel),
    description: `查看預約紀錄、會員資料與商品訂單 — ${ES_BRAND.schoolName}`,
  },
  '/liff/book': {
    title: esBrandPageTitle(ES_BRAND.bookingAreaLabel),
    description: '寬板滑水、快艇衝浪 — 選人數與偏好日期，送出後小編 LINE 回覆確認',
    image: '/liff/book/og.webp',
    imageType: 'image/webp',
  },
  '/book': {
    title: esBrandPageTitle(ES_BRAND.bookingAreaLabel),
    description: '寬板滑水、快艇衝浪 — 選人數與偏好日期，送出後小編 LINE 回覆確認',
    image: '/liff/book/og.webp',
    imageType: 'image/webp',
  },
  '/book/guide': {
    title: esBrandPageTitle(ES_BRAND.guideAreaLabel),
    description: `穿著建議、交通方式、改期規則與預約當日提醒 — ${ES_BRAND.schoolName}`,
    image: '/liff/book/og-guide.webp',
    imageType: 'image/webp',
  },
}

export function normalizeOgPath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

export function getRouteOgMeta(pathname: string): RouteOgMeta | null {
  return ROUTE_OG_BY_PATH[normalizeOgPath(pathname)] ?? null
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

function replaceMetaContent(html: string, pattern: RegExp, content: string): string {
  return html.replace(pattern, `$1${escapeHtmlAttr(content)}$2`)
}

/** 將 index.html 的 OG / title 換成該路由專用（供 Vercel Edge Middleware 使用） */
export function injectRouteOgTags(html: string, meta: RouteOgMeta, canonicalUrl: string): string {
  const origin = new URL(canonicalUrl).origin
  const imagePath = meta.image ?? '/logo.png'
  const imageUrl = `${origin}${imagePath.startsWith('/') ? imagePath : `/${imagePath}`}`
  const imageType = meta.imageType ?? (imagePath.endsWith('.webp') ? 'image/webp' : 'image/png')
  const safeTitle = escapeHtmlAttr(meta.title)
  const safeUrl = escapeHtmlAttr(canonicalUrl)

  let out = html
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`)
  out = replaceMetaContent(out, /(<meta name="description" content=")[^"]*(")/, meta.description)
  out = replaceMetaContent(out, /(<meta property="og:title" content=")[^"]*(")/, meta.title)
  out = replaceMetaContent(out, /(<meta property="og:description" content=")[^"]*(")/, meta.description)
  out = replaceMetaContent(out, /(<meta property="og:image" content=")[^"]*(")/, imageUrl)
  if (out.includes('property="og:image:type"')) {
    out = replaceMetaContent(out, /(<meta property="og:image:type" content=")[^"]*(")/, imageType)
  }
  out = replaceMetaContent(out, /(<meta name="twitter:title" content=")[^"]*(")/, meta.title)
  out = replaceMetaContent(out, /(<meta name="twitter:description" content=")[^"]*(")/, meta.description)
  out = replaceMetaContent(out, /(<meta name="twitter:image" content=")[^"]*(")/, imageUrl)

  if (out.includes('property="og:url"')) {
    out = replaceMetaContent(out, /(<meta property="og:url" content=")[^"]*(")/, canonicalUrl)
  } else {
    out = out.replace(
      '</head>',
      `    <meta property="og:url" content="${safeUrl}" />\n  </head>`,
    )
  }

  return out
}
