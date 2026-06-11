import { useState, type ReactNode } from 'react'

import { triggerHaptic } from '../../../utils/haptic'

import { bookCard } from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

export interface GuideAccordionSection {
  id: string
  title: string
  content: ReactNode
}

interface BookGuideAccordionProps {
  sections: GuideAccordionSection[]
  defaultOpenId?: string
}

export function BookGuideAccordion({ sections, defaultOpenId }: BookGuideAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? sections[0]?.id ?? null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sections.map(section => {
        const open = openId === section.id
        return (
          <div key={section.id} style={{ ...bookCard, marginBottom: 0, padding: 0, overflow: 'hidden' }}>
            <button
              type="button"
              className="book-guide-section-btn"
              onClick={() => {
                triggerHaptic('light')
                setOpenId(open ? null : section.id)
              }}
              aria-expanded={open}
              style={{
                width: '100%',
                padding: '16px',
                border: 'none',
                background: open ? T.surfaceMuted : T.cardBg,
                textAlign: 'left',
                fontSize: ty.title,
                fontWeight: 700,
                color: T.ink,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span>{section.title}</span>
              <span
                style={{
                  flexShrink: 0,
                  color: open ? T.estimateAccent : T.muted,
                  fontSize: 20,
                  lineHeight: 1,
                  fontWeight: 400,
                }}
              >
                {open ? '−' : '+'}
              </span>
            </button>
            {open ? (
              <div
                style={{
                  padding: '0 16px 16px',
                  fontSize: ty.body,
                  color: T.inkSoft,
                  lineHeight: 1.65,
                }}
              >
                {section.content}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
