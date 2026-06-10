import { EsBrandLockup } from '../../../components/EsBrandLockup'
import { BookLocaleToggle, useBookLocale } from './BookLocaleContext'
import { bookHeader, progressBar, progressFill } from './bookStyles'
import { BOOK_TYPE as ty } from './bookTheme'

interface BookStepHeaderProps {
  step: number
}

export function BookStepHeader({ step }: BookStepHeaderProps) {
  const { s } = useBookLocale()
  const total = s.steps.length
  const meta = s.steps[step - 1]
  const progressPct = (step / total) * 100

  return (
    <header style={bookHeader}>
      <EsBrandLockup
        brand={s.header.brand}
        subtitle={s.header.title}
        trailing={<BookLocaleToggle />}
        style={{ marginBottom: 14 }}
      />

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
                fontSize: ty.caption,
                fontWeight: active ? 700 : 500,
                padding: '8px 0',
                borderRadius: 999,
                background: active
                  ? 'rgba(255,255,255,0.24)'
                  : done
                    ? 'rgba(255,255,255,0.18)'
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

      <h1 style={{ fontSize: ty.display, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>{meta.title}</h1>
      <p style={{
        fontSize: ty.caption,
        color: 'rgba(255,255,255,0.78)',
        margin: '6px 0 0',
        lineHeight: 1.45,
      }}
      >
        {meta.subtitle}
      </p>
      <div style={progressBar}><div style={progressFill(progressPct)} /></div>
    </header>
  )
}
