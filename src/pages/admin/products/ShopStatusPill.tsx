import { deriveVariantAvailability } from './availabilityHelpers'

type ShopAvailability = ReturnType<typeof deriveVariantAvailability>

const PILL: Record<ShopAvailability, { bg: string; color: string; label: string }> = {
  in_stock: { bg: '#e8f5e9', color: '#2e7d32', label: '現貨' },
  pre_order: { bg: '#fff8e1', color: '#f57f17', label: '預購' },
  sold_out: { bg: '#f5f5f5', color: '#9e9e9e', label: '已售完' },
}

export function ShopStatusPill({ status }: { status: ShopAvailability }) {
  const pill = PILL[status]
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: pill.bg,
        color: pill.color,
        flexShrink: 0,
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
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: isPublic ? '#fff7ed' : '#f5f5f5',
        color: isPublic ? '#ea580c' : '#9e9e9e',
        flexShrink: 0,
      }}
    >
      {isPublic ? 'Shop 顯示' : 'Shop 隱藏'}
    </span>
  )
}
