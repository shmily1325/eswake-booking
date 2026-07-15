import { useState, type ReactNode } from 'react'

import { triggerHaptic } from '../../../utils/haptic'

import { bookCard, guideAccordionBody, guideAccordionHeader } from './bookStyles'
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
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? null)

  return (
    <div style={{ ...bookCard, marginBottom: 0, padding: 0, overflow: 'hidden' }}>
      {sections.map((section, index) => {
        const open = openId === section.id
        return (
          <div
            key={section.id}
            style={{
              borderBottom: index < sections.length - 1 ? `1px solid ${T.borderSubtle}` : 'none',
            }}
          >
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
                  fontSize: ty.icon,
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
