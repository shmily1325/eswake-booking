import { useEffect } from 'react'
import type { RouteOgMeta } from './routeOgMeta'

/** 瀏覽器分頁 title / description（分享預覽主要靠 Edge Middleware 注入 OG） */
export function useRouteDocumentMeta(meta: RouteOgMeta) {
  useEffect(() => {
    const prevTitle = document.title
    document.title = meta.title

    const descEl = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const prevDesc = descEl?.getAttribute('content') ?? null
    descEl?.setAttribute('content', meta.description)

    return () => {
      document.title = prevTitle
      if (descEl && prevDesc != null) descEl.setAttribute('content', prevDesc)
    }
  }, [meta.title, meta.description])
}
