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

function BookStepProgress({ step }: { step: number }) {
  const { s } = useBookLocale()
  const total = s.steps.length
  const progressPct = (step / total) * 100
  const current = s.steps[step - 1]

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: ty.body, fontWeight: 700, color: 'white' }}>{current.pill}</span>
        <span style={{ fontSize: ty.caption, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>
          {step}/{total}
        </span>
      </div>
      <div style={progressBar}><div style={progressFill(progressPct)} /></div>
    </>
  )
}

/** LIFF：品牌 + 步驟進度合併為單一 sticky 列 */
export function BookLiffWizardHeader({ step }: { step: number }) {
  const { s } = useBookLocale()
  return (
    <header style={bookHeader}>
      <EsBrandLockup
        brand={s.header.brand}
        subtitle={s.header.title}
        logoSize={26}
        trailing={<BookLocaleToggle surface="header" />}
        style={{ marginBottom: 10 }}
      />
      <BookStepProgress step={step} />
    </header>
  )
}

/** @deprecated 保留給非 LIFF 路徑；公開 /book 用 BookHeader + BookStepHeader */
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

/** Sticky：當前步驟 + 進度（公開 /book 在 BookHeader 下方） */
export function BookStepHeader({ step }: { step: number }) {
  return (
    <header style={bookHeader}>
      <BookStepProgress step={step} />
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
