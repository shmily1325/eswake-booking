import type { CSSProperties } from 'react'
import { OFFICIAL_PRICE_FOOTNOTES, OFFICIAL_PRICE_INCLUDES, OFFICIAL_PRICE_SECTIONS } from './liffBookingPrices'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

const sectionTitle: CSSProperties = {
  fontSize: ty.title - 1,
  fontWeight: 700,
  color: T.ink,
  margin: '0 0 6px',
}

const rowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  padding: '10px 0',
  borderBottom: `1px solid ${T.borderSubtle}`,
  fontSize: ty.body,
  lineHeight: 1.4,
}

export function BookPriceTable() {
  return (
    <div>
      {OFFICIAL_PRICE_SECTIONS.map((section, idx) => (
        <div key={section.title} style={{ marginTop: idx === 0 ? 0 : 20 }}>
          <h3 style={sectionTitle}>{section.title}</h3>
          {section.note && (
            <p style={{ fontSize: ty.caption, color: T.mutedLight, margin: '0 0 8px', lineHeight: 1.5 }}>
              {section.note}
            </p>
          )}
          {section.rows.map(row => (
            <div key={row.label} style={rowStyle}>
              <span style={{ color: T.inkSoft, flex: 1 }}>{row.label}</span>
              <span style={{ fontWeight: 600, color: T.ink, whiteSpace: 'nowrap' }}>
                {row.priceLabel ?? (
                  <>
                    ${row.price!.toLocaleString()}
                    {row.unit ? (
                      <span style={{ fontWeight: 400, color: T.mutedLight }}> / {row.unit}</span>
                    ) : null}
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      ))}
      <p style={{ fontSize: ty.caption, color: T.mutedLight, margin: '16px 0 0', lineHeight: 1.5 }}>
        ● {OFFICIAL_PRICE_INCLUDES}
      </p>
      {OFFICIAL_PRICE_FOOTNOTES.map(note => (
        <p key={note} style={{ fontSize: ty.caption, color: T.mutedLight, margin: '6px 0 0', lineHeight: 1.5 }}>
          ● {note}
        </p>
      ))}
    </div>
  )
}
