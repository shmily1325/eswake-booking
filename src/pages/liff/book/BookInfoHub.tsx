import type { CSSProperties } from 'react'
import { BOAT_RULES, PRICING_RULES } from './liffBookingBoats'
import {
  BOAT_BOTH_ACTIVITIES_NOTE,
  BOAT_COMFORT_NOTE,
  BOAT_INTRO_VIDEO_ID,
  BOOKING_REMINDERS,
} from './liffBookingReminders'
import { FAQ_ITEMS } from './liffBookingContent'
import { BookAccordion } from './BookAccordion'
import { BookPriceTable } from './BookPriceTable'
import { BookVideoPlayer } from './BookVideoPlayer'

const sectionHead: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: '#222',
  margin: '0 0 10px',
}

const ruleRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  fontSize: 14,
  color: '#444',
  lineHeight: 1.5,
  marginBottom: 8,
}

const boatCard: CSSProperties = {
  border: '1px solid #e8e8e8',
  borderRadius: 12,
  padding: 14,
  marginBottom: 10,
  background: '#fafafa',
}

/**
 * 所有「須知」集中於此，依固定順序排列：
 * 費用規則 → 船型 → 價目表 → 預約留意 → FAQ
 */
export function BookInfoHub() {
  return (
    <div>
      <section style={{ marginBottom: 24 }}>
        <h3 style={sectionHead}>① 費用怎麼算</h3>
        {PRICING_RULES.map(r => (
          <div key={r.text} style={ruleRow}>
            <span>{r.text}</span>
          </div>
        ))}
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3 style={sectionHead}>② 船型怎麼選</h3>
        {BOAT_RULES.map(b => (
          <div key={b.tier} style={boatCard}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              {b.label} · 最多 {b.maxPeople} 人
            </div>
            <div style={{ fontSize: 13, color: '#666' }}>{b.activities}</div>
          </div>
        ))}
        <p style={{ fontSize: 13, color: '#888', lineHeight: 1.55, margin: '8px 0' }}>
          {BOAT_COMFORT_NOTE}<br />{BOAT_BOTH_ACTIVITIES_NOTE}
        </p>
        <BookVideoPlayer videoId={BOAT_INTRO_VIDEO_ID} title="船型介紹" label="船型介紹影片" />
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3 style={sectionHead}>③ 完整價目表</h3>
        <BookPriceTable />
      </section>

      <section style={{ marginBottom: 24 }}>
        <h3 style={sectionHead}>④ 預約前留意</h3>
        {BOOKING_REMINDERS.map(r => (
          <div
            key={r.id}
            style={{
              ...ruleRow,
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 8,
            }}
          >
            <span>{r.text}</span>
          </div>
        ))}
        <div style={{ ...ruleRow, marginTop: 8 }}>
          <span>跟船：第一位免費，第二位起每位 $300（請預約時告知）</span>
        </div>
      </section>

      <section>
        <h3 style={sectionHead}>⑤ 常見問題</h3>
        <BookAccordion items={FAQ_ITEMS} />
      </section>
    </div>
  )
}
