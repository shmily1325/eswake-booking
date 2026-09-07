const HEX_COLOR = /^#[0-9a-f]{6}$/i
const SEPARATOR = ' · '

export interface PantoneSelection {
  code: string
  previewHex: string
}

export function normalizePreviewHex(value: string): string | null {
  const normalized = value.trim()
  return HEX_COLOR.test(normalized) ? normalized.toUpperCase() : null
}

export function formatPantoneSelection(code: string, previewHex: string): string {
  const normalizedCode = code.trim().toUpperCase()
  const normalizedHex = normalizePreviewHex(previewHex)
  return normalizedHex
    ? `${normalizedCode}${SEPARATOR}${normalizedHex}`
    : normalizedCode
}

export function parsePantoneSelection(value: string): PantoneSelection | null {
  const separatorIndex = value.lastIndexOf(SEPARATOR)
  if (separatorIndex < 1) return null
  const code = value.slice(0, separatorIndex).trim()
  const previewHex = normalizePreviewHex(value.slice(separatorIndex + SEPARATOR.length))
  return code && previewHex ? { code, previewHex } : null
}
