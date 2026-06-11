import { EsBrandLockup } from '../../../components/EsBrandLockup'
import { BookLocaleToggle, useBookLocale } from './BookLocaleContext'
import {
  bookBrandBar,
  bookHeader,
  bookStepIntroBlock,
  progressBar,
  progressFill,
} from './bookStyles'
import { BOOK_THEME as T, BOOK_TYPE as ty } from './bookTheme'

/** LIFF：品牌列隨內容捲走，不 sticky */
export function BookWizardBrandBar() {
  const { s } = useBookLocale()
  return (
    <div style={bookBrandBar}>
      <EsBrandLockup
        brand={s.header.brand}
        subtitle={s.header.title}
        trailing={<BookLocaleToggle />}
        style={{ marginBottom: 0 }}
      />
    </div>
  )
}

/** Sticky：步驟 pill + progress 細線 */
export function BookStepHeader({ step }: { step: number }) {
  const { s } = useBookLocale()
  const total = s.steps.length
  const progressPct = (step / total) * 100

  return (
    <header style={bookHeader}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
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
                padding: '5px 0',
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
      <div style={progressBar}><div style={progressFill(progressPct)} /></div>
    </header>
  )
}

/** 步驟標題與說明：在 main 內，隨內容捲動 */
export function BookStepIntro({ step }: { step: number }) {
  const { s } = useBookLocale()
  const meta = s.steps[step - 1]

  return (
    <div style={bookStepIntroBlock}>
      <h1 style={{ fontSize: ty.display, fontWeight: 700, margin: 0, lineHeight: 1.3, color: T.ink }}>
        {meta.title}
      </h1>
      <p style={{ fontSize: ty.caption, color: T.muted, margin: '6px 0 0', lineHeight: 1.45 }}>
        {meta.subtitle}
      </p>
    </div>
  )
}
