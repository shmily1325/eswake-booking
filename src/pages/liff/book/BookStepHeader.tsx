import { BOOKING_WIZARD_STEPS } from './liffBookingSteps'
import { progressBar, progressFill } from './bookStyles'

interface BookStepHeaderProps {
  step: number
  priceHint?: string | null
  memberHint?: boolean
}

export function BookStepHeader({ step, priceHint, memberHint }: BookStepHeaderProps) {
  const total = BOOKING_WIZARD_STEPS.length
  const meta = BOOKING_WIZARD_STEPS[step - 1]
  const progressPct = (step / total) * 100

  return (
    <header style={{
      background: 'linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%)',
      color: 'white',
      padding: '16px 16px 14px',
      paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
    }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {BOOKING_WIZARD_STEPS.map(s => {
          const done = s.id < step
          const active = s.id === step
          return (
            <div
              key={s.id}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                padding: '6px 0',
                borderRadius: 999,
                background: active ? 'rgba(255,255,255,0.22)' : done ? 'rgba(0,185,0,0.35)' : 'rgba(255,255,255,0.08)',
                color: active || done ? 'white' : 'rgba(255,255,255,0.55)',
              }}
            >
              {s.pill}
            </div>
          )
        })}
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{meta.title}</h1>
      <div style={progressBar}><div style={progressFill(progressPct)} /></div>

      {priceHint && (
        <div style={{
          marginTop: 10,
          fontSize: 14,
          fontWeight: 600,
        }}>
          💰 {priceHint}
        </div>
      )}
      {memberHint && (
        <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>會員價估算</div>
      )}
    </header>
  )
}
