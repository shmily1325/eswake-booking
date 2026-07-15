import { useState } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import type { FaqItem } from './liffBookingContent'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

interface BookAccordionProps {
  items: FaqItem[]
  /** 預設展開第一則 */
  defaultOpenId?: string
}

export function BookAccordion({ items, defaultOpenId }: BookAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => {
        const open = openId === item.id
        return (
          <div
            key={item.id}
            style={{
              border: `1px solid ${T.borderSubtle}`,
              borderRadius: T.smallRadius,
              overflow: 'hidden',
              background: T.cardBg,
            }}
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic('light')
                setOpenId(open ? null : item.id)
              }}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: 'none',
                background: open ? T.surfaceMuted : T.cardBg,
                textAlign: 'left',
                fontSize: ty.body,
                fontWeight: 600,
                color: T.inkSoft,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{item.question}</span>
              <span style={{ color: T.mutedLight, fontSize: ty.icon, lineHeight: 1 }}>{open ? '−' : '+'}</span>
            </button>
            {open && (
              <div
                style={{
                  padding: '0 16px 14px',
                  fontSize: ty.body,
                  color: T.muted,
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {item.answer}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
