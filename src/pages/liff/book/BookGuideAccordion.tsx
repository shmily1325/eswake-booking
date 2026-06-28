import { useState, type ReactNode } from 'react'

import { triggerHaptic } from '../../../utils/haptic'

import { bookCard, guideAccordionBody, guideAccordionHeader } from './bookStyles'
import { BOOK_THEME as T } from './bookTheme'

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
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? null)

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
              style={guideAccordionHeader(open)}
            >
              <span style={{ flex: 1, minWidth: 0, paddingRight: 4 }}>{section.title}</span>
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
              <div style={guideAccordionBody}>
                {section.content}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
