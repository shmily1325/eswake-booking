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
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'
import { liffAlertTone } from '../liffUiStyles'

const sectionHead: CSSProperties = {
  fontSize: ty.title - 1,
  fontWeight: 700,
  color: T.ink,
  margin: '0 0 10px',
}

const ruleRow: CSSProperties = {
  display: 'flex',
  gap: 10,
  fontSize: ty.body,
  color: T.inkSoft,
  lineHeight: 1.5,
  marginBottom: 8,
}

const boatCard: CSSProperties = {
  border: `1px solid ${T.borderSubtle}`,
  borderRadius: 12,
  padding: 14,
  marginBottom: 10,
  background: T.surfaceMuted,
}

const reminderTone = liffAlertTone('warning')

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
            <div style={{ fontWeight: 700, fontSize: ty.title - 1, marginBottom: 4, color: T.inkSoft }}>
              {b.label} · 最多 {b.maxPeople} 人
            </div>
            <div style={{ fontSize: ty.caption + 1, color: T.muted }}>{b.activities}</div>
          </div>
        ))}
        <p style={{ fontSize: ty.caption + 1, color: T.mutedLight, lineHeight: 1.55, margin: '8px 0' }}>
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
              background: reminderTone.bg,
              border: `1px solid ${reminderTone.border}`,
              borderRadius: 10,
              padding: '10px 12px',
              marginBottom: 8,
              color: reminderTone.color,
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
