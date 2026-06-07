export interface RouteOgMeta {
  title: string
  description: string
}

/** 依路徑的 Open Graph（LINE / Facebook 分享預覽） */
export const ROUTE_OG_BY_PATH: Record<string, RouteOgMeta> = {
  '/liff': {
    title: 'ES WAKE 會員專區',
    description: '查看預約紀錄、會員資料與商品訂單 — ES Wake 滑水學校',
  },
  '/liff/book': {
    title: 'ES WAKE 線上預約',
    description: '選活動、填人數與日期，一鍵送出預約詢問 — ES Wake 滑水學校',
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
  const imageUrl = `${new URL(canonicalUrl).origin}/logo.png`
  const safeTitle = escapeHtmlAttr(meta.title)
  const safeUrl = escapeHtmlAttr(canonicalUrl)

  let out = html
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`)
  out = replaceMetaContent(out, /(<meta name="description" content=")[^"]*(")/, meta.description)
  out = replaceMetaContent(out, /(<meta property="og:title" content=")[^"]*(")/, meta.title)
  out = replaceMetaContent(out, /(<meta property="og:description" content=")[^"]*(")/, meta.description)
  out = replaceMetaContent(out, /(<meta property="og:image" content=")[^"]*(")/, imageUrl)
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
