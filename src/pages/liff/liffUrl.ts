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

function channelIdFromLiffId(liffId: string | undefined): string | null {
  const normalized = liffId?.trim()
  if (!normalized) return null
  const separator = normalized.indexOf('-')
  return separator > 0 ? normalized.slice(0, separator) : normalized
}

/**
 * During LIFF provider migration both LIFF URLs point to the same endpoint.
 * LINE adds liffClientId to the endpoint URL, so select the matching full LIFF
 * ID without interrupting users who still enter through the legacy URL.
 */
export function resolveRuntimeLiffId(
  primaryLiffId: string | undefined,
  migrationLiffId: string | undefined,
  search = typeof window === 'undefined' ? '' : window.location.search,
): string | undefined {
  const primary = primaryLiffId?.trim() || undefined
  const migration = migrationLiffId?.trim() || undefined
  if (!migration) return primary

  const clientId = new URLSearchParams(search).get('liffClientId')
  if (!clientId) return primary || migration

  if (channelIdFromLiffId(migration) === clientId) return migration
  if (channelIdFromLiffId(primary) === clientId) return primary
  return primary
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
