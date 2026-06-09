import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  BOOK_I18N,
  persistBookLocale,
  readInitialBookLocale,
  type BookI18nStrings,
  type BookLocale,
} from './liffBookingI18n'

interface BookLocaleContextValue {
  locale: BookLocale
  setLocale: (locale: BookLocale) => void
  s: BookI18nStrings
}

const BookLocaleContext = createContext<BookLocaleContextValue | null>(null)

export function BookLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<BookLocale>(readInitialBookLocale)

  const setLocale = useCallback((next: BookLocale) => {
    persistBookLocale(next)
    setLocaleState(next)
  }, [])

  const value = useMemo(
    () => ({ locale, setLocale, s: BOOK_I18N[locale] }),
    [locale, setLocale],
  )

  return (
    <BookLocaleContext.Provider value={value}>
      {children}
    </BookLocaleContext.Provider>
  )
}

export function useBookLocale(): BookLocaleContextValue {
  const ctx = useContext(BookLocaleContext)
  if (!ctx) throw new Error('useBookLocale must be used within BookLocaleProvider')
  return ctx
}

interface BookLocaleToggleProps {
  style?: React.CSSProperties
  /** 與 BookStepHeader 深色底一致；card 用於白底卡片內 */
  surface?: 'header' | 'card'
}

/** Header 角落：中文 | EN */
export function BookLocaleToggle({ style, surface = 'header' }: BookLocaleToggleProps) {
  const { locale, setLocale, s } = useBookLocale()
  const onCard = surface === 'card'

  const seg = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px',
    border: 'none',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    background: active
      ? onCard ? 'rgba(74,74,74,0.12)' : 'rgba(255,255,255,0.28)'
      : 'transparent',
    color: active
      ? onCard ? '#333' : '#fff'
      : onCard ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.65)',
    boxShadow: active
      ? onCard ? 'inset 0 0 0 1px rgba(0,0,0,0.08)' : 'inset 0 0 0 1px rgba(255,255,255,0.2)'
      : 'none',
  })

  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        borderRadius: 999,
        background: onCard ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.12)',
        ...style,
      }}
      role="group"
      aria-label="Language"
    >
      <button type="button" style={seg(locale === 'zh')} onClick={() => setLocale('zh')}>
        {s.localeToggle.zh}
      </button>
      <button type="button" style={seg(locale === 'en')} onClick={() => setLocale('en')}>
        {s.localeToggle.en}
      </button>
    </div>
  )
}
