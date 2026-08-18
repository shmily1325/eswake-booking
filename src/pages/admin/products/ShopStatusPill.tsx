/**
 * Design thinking:
 * Current feel: Material greens/oranges read as admin status noise.
 * Hierarchy: label text first; soft tonal fill only for quick scan.
 * Primary task: recognize 現貨 / 預購 / 已售完 / 上架 without competing chrome.
 */
import type { CSSProperties } from 'react'
import { designSystem, getFontSize } from '../../../styles/designSystem'
import { deriveVariantAvailability } from './availabilityHelpers'

type ShopAvailability = ReturnType<typeof deriveVariantAvailability>

const { colors } = designSystem

const PILL: Record<ShopAvailability, { bg: string; color: string; label: string }> = {
  in_stock: { bg: 'transparent', color: colors.text.secondary, label: '現貨' },
  pre_order: { bg: 'transparent', color: colors.text.primary, label: '預購' },
  sold_out: { bg: 'transparent', color: colors.text.disabled, label: '已售完' },
}

const pillBase: CSSProperties = {
  fontWeight: 500,
  padding: 0,
  flexShrink: 0,
}

export function ShopStatusPill({ status, isMobile }: { status: ShopAvailability; isMobile: boolean }) {
  const pill = PILL[status]
  return (
    <span
      style={{
        ...pillBase,
        fontSize: getFontSize('caption', isMobile),
        background: pill.bg,
        color: pill.color,
      }}
    >
      {pill.label}
    </span>
  )
}

export function ShopVisibilityPill({ isPublic, isMobile }: { isPublic: boolean; isMobile: boolean }) {
  return (
    <span
      style={{
        ...pillBase,
        fontSize: getFontSize('caption', isMobile),
        background: 'transparent',
        color: isPublic ? colors.text.primary : colors.text.disabled,
      }}
    >
      {isPublic ? '上架' : '未上架'}
    </span>
  )
}
