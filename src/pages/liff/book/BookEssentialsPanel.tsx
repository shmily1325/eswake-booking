import { useState } from 'react'
import type { CSSProperties } from 'react'
import { ACTIVITY_OPTIONS } from './liffBookingConfig'
import { BOAT_RULES } from './liffBookingBoats'
import { firstTimeUnitPrice, sessionBlockRate } from './liffBookingPrices'
import type { ActivityCode } from './types'
import { bookCard } from './bookStyles'
import { BookStaffHint } from './BookStaffHint'

const sectionHead: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#222',
  margin: '0 0 8px',
}

const priceGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '64px 1fr 1fr',
  gap: '5px 8px',
  fontSize: 12,
  lineHeight: 1.4,
}

function VideoEmbed({ videoId }: { videoId: string }) {
  return (
    <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0, borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
      <iframe
        title="起滑影片"
        src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  )
}

/**
 * Step 1 必讀三件事：項目差別、價格、船隻。
 * 預設展開、版面精簡；細節 FAQ 留給預約須知 hub。
 */
export function BookEssentialsPanel() {
  const [videoCode, setVideoCode] = useState<ActivityCode | null>(null)
  const ws = ACTIVITY_OPTIONS.find(a => a.code === 'WS')!
  const wb = ACTIVITY_OPTIONS.find(a => a.code === 'WB')!

  const wsGuest = sessionBlockRate('big', false)
  const wsMember = sessionBlockRate('big', true)
  const wbGuest = sessionBlockRate('small', false)
  const wbMember = sessionBlockRate('small', true)

  return (
    <div style={{ ...bookCard, marginBottom: 12, padding: '14px 14px 10px' }}>
      <p style={{ fontSize: 13, color: '#555', margin: '0 0 12px', lineHeight: 1.5 }}>
        先快速了解下面三點，再選項目填表單即可。
      </p>

      <section style={{ marginBottom: 14 }}>
        <h2 style={sectionHead}>① 項目差別</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {[ws, wb].map(opt => (
            <div
              key={opt.code}
              style={{
                flex: 1,
                padding: '10px 8px',
                background: '#f8f8f8',
                borderRadius: 10,
                fontSize: 12,
                lineHeight: 1.45,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{opt.emoji} {opt.labelZh}</div>
              <div style={{ color: '#666' }}>{opt.tagline}</div>
              <button
                type="button"
                onClick={() => setVideoCode(v => v === opt.code ? null : opt.code)}
                style={{
                  marginTop: 6, padding: 0, border: 'none', background: 'none',
                  color: '#888', fontSize: 11, cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                {videoCode === opt.code ? '收合' : '▶ 影片'}
              </button>
              {videoCode === opt.code && <VideoEmbed videoId={opt.youtubeVideoId} />}
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 14 }}>
        <h2 style={sectionHead}>② 價格（每位 · 2026）</h2>
        <div style={priceGrid}>
          <div />
          <div style={{ fontWeight: 600 }}>🌊 衝浪</div>
          <div style={{ fontWeight: 600 }}>🏄 滑水</div>
          <div style={{ color: '#999' }}>首次</div>
          <div>${firstTimeUnitPrice('WS').toLocaleString()}</div>
          <div>${firstTimeUnitPrice('WB').toLocaleString()}</div>
          <div style={{ color: '#999' }}>非會員</div>
          <div>${wsGuest.price}/{wsGuest.blockMin}分</div>
          <div>${wbGuest.price}/{wbGuest.blockMin}分</div>
          <div style={{ color: '#999' }}>會員</div>
          <div>${wsMember.price}/{wsMember.blockMin}分</div>
          <div>${wbMember.price}/{wbMember.blockMin}分</div>
        </div>
        <p style={{ fontSize: 11, color: '#aaa', margin: '6px 0 0' }}>
          初學→首次價 · 非初學→上表計時
        </p>
      </section>

      <section>
        <h2 style={sectionHead}>③ 船隻</h2>
        {BOAT_RULES.map(b => (
          <div key={b.tier} style={{ fontSize: 12, color: '#444', lineHeight: 1.5, marginBottom: 4 }}>
            {b.emoji} <strong>{b.label}</strong> 最多 {b.maxPeople} 人 · {b.activities}
          </div>
        ))}
        <p style={{ fontSize: 11, color: '#aaa', margin: '4px 0 0' }}>
          兩項都要玩 → 大船
        </p>
      </section>

      <BookStaffHint />
    </div>
  )
}
