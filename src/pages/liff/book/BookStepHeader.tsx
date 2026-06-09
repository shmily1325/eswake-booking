import { BookLocaleToggle, useBookLocale } from './BookLocaleContext'
import { bookHeader, progressBar, progressFill } from './bookStyles'

interface BookStepHeaderProps {
  step: number
  priceHint?: string | null
  memberHint?: boolean
}

export function BookStepHeader({ step, priceHint, memberHint }: BookStepHeaderProps) {
  const { s } = useBookLocale()
  const total = s.steps.length
  const meta = s.steps[step - 1]
  const progressPct = (step / total) * 100

  return (
    <header style={bookHeader}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 14,
        gap: 8,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.75, letterSpacing: '0.06em' }}>
            {s.header.brand}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2, lineHeight: 1.2 }}>
            {s.header.title}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <BookLocaleToggle />
          <img
            src="/logo_circle (white).png"
            alt=""
            width={36}
            height={36}
            style={{ objectFit: 'contain', opacity: 0.95 }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {s.steps.map(st => {
          const done = st.id < step
          const active = st.id === step
          return (
            <div
              key={st.id}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 11,
                fontWeight: active ? 700 : 500,
                padding: '7px 0',
                borderRadius: 999,
                background: active
                  ? 'rgba(255,255,255,0.24)'
                  : done
                    ? 'rgba(0,185,0,0.32)'
                    : 'rgba(255,255,255,0.08)',
                color: active || done ? 'white' : 'rgba(255,255,255,0.5)',
                boxShadow: active ? 'inset 0 0 0 1px rgba(255,255,255,0.15)' : 'none',
              }}
            >
              {st.pill}
            </div>
          )
        })}
      </div>

      <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{meta.title}</h1>
      <div style={progressBar}><div style={progressFill(progressPct)} /></div>

      {priceHint && (
        <div style={{ marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.01em' }}>
            {priceHint}
          </div>
          <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
            {s.estimate.reference}
          </div>
        </div>
      )}
      {memberHint && (
        <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>{s.header.memberRateHint}</div>
      )}
    </header>
  )
}
