const STORAGE_PREFIX = 'eswake-shop-list-position:'
const MAX_AGE_MS = 30 * 60 * 1000

interface ShopListPosition {
  y: number
  horizontal: Record<string, number>
  savedAt: number
}

function storageKey(returnTo: string): string {
  return `${STORAGE_PREFIX}${returnTo}`
}

export function readShopListPosition(returnTo: string): ShopListPosition | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(returnTo))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ShopListPosition>
    if (
      typeof parsed.y !== 'number' ||
      !Number.isFinite(parsed.y) ||
      typeof parsed.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(storageKey(returnTo))
      return null
    }
    return {
      y: Math.max(0, parsed.y),
      horizontal:
        parsed.horizontal && typeof parsed.horizontal === 'object'
          ? parsed.horizontal
          : {},
      savedAt: parsed.savedAt,
    }
  } catch {
    return null
  }
}

export function saveShopListPosition(
  returnTo: string,
  horizontal?: { key: string; left: number },
): void {
  try {
    const previous = readShopListPosition(returnTo)
    const nextHorizontal = { ...(previous?.horizontal ?? {}) }
    if (horizontal && Number.isFinite(horizontal.left)) {
      nextHorizontal[horizontal.key] = Math.max(0, horizontal.left)
    }
    const position: ShopListPosition = {
      y: Math.max(0, window.scrollY),
      horizontal: nextHorizontal,
      savedAt: Date.now(),
    }
    window.sessionStorage.setItem(storageKey(returnTo), JSON.stringify(position))
  } catch {
    // sessionStorage may be unavailable; normal navigation still works.
  }
}

export function clearShopListPosition(returnTo: string): void {
  try {
    window.sessionStorage.removeItem(storageKey(returnTo))
  } catch {
    // Ignore unavailable storage.
  }
}
