import type { CSSProperties } from 'react'
import { triggerHaptic } from '../../../utils/haptic'
import { ACTIVITY_OPTIONS, BOTH_ACTIVITY_SHORT } from './liffBookingConfig'
import type { ActivityChoice } from './types'
import { BookActivityIcon, BookBothIcons } from './BookActivityIcon'
import { BookVideoPlayer } from './BookVideoPlayer'
import { fieldLabel } from './bookStyles'

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
  marginBottom: 10,
}

function activityCard(selected: boolean): CSSProperties {
  return {
    borderRadius: 14,
    border: selected ? '2px solid #4a4a4a' : '1px solid #e8e8e8',
    background: selected ? '#fafafa' : '#fff',
    boxShadow: selected
      ? '0 0 0 3px rgba(74,74,74,0.12)'
      : '0 1px 3px rgba(0,0,0,0.04)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  }
}

const selectBtn: CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: '14px 10px 10px',
  textAlign: 'center',
  width: '100%',
}

const iconWrap: CSSProperties = {
  height: 72,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 8,
}

const bothCard = (selected: boolean): CSSProperties => ({
  ...activityCard(selected),
  width: '100%',
  marginBottom: 8,
})

interface BookActivityPickerProps {
  value: ActivityChoice | null
  onChange: (code: ActivityChoice) => void
}

export function BookActivityPicker({ value, onChange }: BookActivityPickerProps) {
  return (
    <>
      <div style={{ ...fieldLabel, marginTop: 4, marginBottom: 10 }}>選擇項目</div>

      <div style={grid}>
        {ACTIVITY_OPTIONS.map(opt => {
          const selected = value === opt.code
          return (
            <div key={opt.code} style={activityCard(selected)}>
              <button
                type="button"
                style={selectBtn}
                onClick={() => {
                  triggerHaptic('light')
                  onChange(opt.code)
                }}
              >
                <div style={iconWrap}>
                  <BookActivityIcon code={opt.code} size={56} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#222' }}>{opt.labelZh}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 4, lineHeight: 1.4 }}>{opt.tagline}</div>
              </button>
              <div style={{ padding: '0 8px 8px' }}>
                <BookVideoPlayer variant="compact" videoId={opt.youtubeVideoId} title={opt.labelZh} />
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        style={bothCard(value === 'BOTH')}
        onClick={() => {
          triggerHaptic('light')
          onChange('BOTH')
        }}
      >
        <div style={{ ...selectBtn, padding: '12px 14px 14px' }}>
          <BookBothIcons size={32} style={{ marginBottom: 8 }} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#222' }}>{BOTH_ACTIVITY_SHORT}</div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            快艇衝浪 + 寬板滑水 · 需大船
          </div>
        </div>
      </button>
    </>
  )
}
