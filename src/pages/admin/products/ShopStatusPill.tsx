/**
 * Design thinking:
 * Current feel: Material greens/oranges read as admin status noise.
 * Hierarchy: label text first; soft tonal fill only for quick scan.
 * Primary task: recognize 現貨 / 預購 / 已售完 / Shop 顯示 without competing chrome.
 */
import type { CSSProperties } from 'react'
import { designSystem, getFontSize } from '../../../styles/designSystem'
import { deriveVariantAvailability } from './availabilityHelpers'

type ShopAvailability = ReturnType<typeof deriveVariantAvailability>

const { colors } = designSystem

const PILL: Record<ShopAvailability, { bg: string; color: string; label: string }> = {
  in_stock: { bg: colors.success[50], color: colors.success[700], label: '現貨' },
  pre_order: { bg: colors.warning[50], color: colors.warning[700], label: '預購' },
  sold_out: { bg: colors.secondary[100], color: colors.text.disabled, label: '已售完' },
}

const pillBase: CSSProperties = {
  fontSize: getFontSize('caption', true),
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: designSystem.borderRadius.full,
  flexShrink: 0,
}

export function ShopStatusPill({ status }: { status: ShopAvailability }) {
  const pill = PILL[status]
  return (
    <span
      style={{
        ...pillBase,
        background: pill.bg,
        color: pill.color,
      }}
    >
      {pill.label}
    </span>
  )
}

export function ShopVisibilityPill({ isPublic }: { isPublic: boolean }) {
  return (
    <span
      style={{
        ...pillBase,
        background: isPublic ? colors.warning[50] : colors.secondary[100],
        color: isPublic ? colors.warning[700] : colors.text.disabled,
      }}
    >
      {isPublic ? 'Shop 顯示' : 'Shop 隱藏'}
    </span>
  )
}
