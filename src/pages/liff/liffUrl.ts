const LIFF_TECHNICAL_QUERY_KEYS = [
  'code',
  'state',
  'liffClientId',
  'liffRedirectUri',
  'liff.state',
]

export function buildLiffShareUrl(liffId: string, suffix = ''): string {
  const normalizedSuffix = suffix && !/^[/?#]/.test(suffix) ? `?${suffix}` : suffix
  return `https://liff.line.me/${liffId}${normalizedSuffix}`
}

/** Preserve the original LIFF state, or ordinary query/hash, when reopening through liff.line.me. */
export function getCurrentLiffDeepLinkSuffix(
  location: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location,
): string {
  const params = new URLSearchParams(location.search)
  const liffState = params.get('liff.state')
  if (liffState) return liffState

  LIFF_TECHNICAL_QUERY_KEYS.forEach((key) => params.delete(key))
  const query = params.toString()
  const nestedPath = location.pathname.startsWith('/liff/')
    ? location.pathname.slice('/liff'.length)
    : ''
  return `${nestedPath}${query ? `?${query}` : ''}${location.hash}`
}

/** OAuth redirectUri 必須以 LIFF Endpoint URL 為前綴（保留供日後需要時使用） */
export function buildLiffLoginRedirectUri(endpointPath: string): string {
  const normalized = endpointPath.replace(/\/+$/, '') || '/'
  const current = window.location.pathname.replace(/\/+$/, '') || '/'
  const origin = window.location.origin
  if (current === normalized || current.startsWith(`${normalized}/`)) {
    return `${origin}${window.location.pathname}${window.location.search}`
  }
  return `${origin}${normalized}`
}
