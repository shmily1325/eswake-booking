const RIDER_SEPARATOR_PATTERN = /[+＋,，、/]+/

export function parseActualRiders(value: string | null | undefined): string[] {
  if (!value) return []

  const seen = new Set<string>()
  return value
    .split(RIDER_SEPARATOR_PATTERN)
    .map((name) => name.trim())
    .filter((name) => {
      if (!name || seen.has(name)) return false
      seen.add(name)
      return true
    })
}

export function formatActualRider(value: string | null | undefined): string {
  return parseActualRiders(value).join('＋')
}

export function normalizeActualRiderForSave(value: string | null | undefined): string | null {
  return formatActualRider(value) || null
}

export function getActualRiderGroupKey(value: string | null | undefined): string {
  return [...parseActualRiders(value)]
    .sort((left, right) => left.localeCompare(right, 'zh-Hant'))
    .join('\u0000')
}

export function appendActualRiderSeparator(value: string): string {
  const trimmed = value.trimEnd()
  if (!trimmed || /[+＋,，、/]$/.test(trimmed)) return value
  return `${trimmed}＋`
}

export function formatBookingDisplayName(
  contactName: string,
  actualRider: string | null | undefined,
): string {
  const rider = formatActualRider(actualRider)
  return rider ? `${contactName}（${rider}）` : contactName
}
