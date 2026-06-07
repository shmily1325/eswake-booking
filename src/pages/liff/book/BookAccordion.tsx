import { useState } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import type { FaqItem } from './liffBookingContent'

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
              border: '1px solid #e8e8e8',
              borderRadius: 10,
              overflow: 'hidden',
              background: 'white',
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
                background: open ? '#fafafa' : 'white',
                textAlign: 'left',
                fontSize: 14,
                fontWeight: 600,
                color: '#333',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{item.question}</span>
              <span style={{ color: '#999', fontSize: 18, lineHeight: 1 }}>{open ? '−' : '+'}</span>
            </button>
            {open && (
              <div
                style={{
                  padding: '0 16px 14px',
                  fontSize: 14,
                  color: '#555',
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
