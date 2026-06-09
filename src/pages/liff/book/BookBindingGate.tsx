/**
 * 預約表單專用綁定（未綁定會員可選；多數人略過以訪客填寫）
 */
import { EsBrandLockup } from '../../../components/EsBrandLockup'
import { liffTrack } from '../track'
import {
  liffBindingCard,
  liffBindingShell,
  liffGhostBtn,
  liffInput,
  liffLabel,
  liffLineBtn,
  liffPrimaryBtn,
  liffSelect,
  LIFF_THEME,
  LIFF_TYPE,
} from '../liffUiStyles'
import { BookLocaleToggle, useBookLocale } from './BookLocaleContext'

interface BookBindingGateProps {
  phone: string
  setPhone: (phone: string) => void
  birthYear: string
  setBirthYear: (year: string) => void
  birthMonth: string
  setBirthMonth: (month: string) => void
  birthDay: string
  setBirthDay: (day: string) => void
  binding: boolean
  bindingError: string | null
  setBindingError: (error: string | null) => void
  onSubmit: () => void
  onSkip: () => void
}

export function BookBindingGate({
  phone,
  setPhone,
  birthYear,
  setBirthYear,
  birthMonth,
  setBirthMonth,
  birthDay,
  setBirthDay,
  binding,
  bindingError,
  setBindingError,
  onSubmit,
  onSkip,
}: BookBindingGateProps) {
  const { locale, s } = useBookLocale()
  const b = s.binding
  const isFormValid = phone && birthYear && birthMonth && birthDay
  const oaUrl = import.meta.env.VITE_LINE_OA_URL as string | undefined

  function openOfficialContact() {
    if (!oaUrl) return
    try {
      liffTrack({ icon_id: 'liff_book_contact_official', line_user_id: null })
    } catch {
      // ignore
    }
    try {
      window.open(oaUrl, '_blank', 'noopener,noreferrer')
    } catch {
      window.location.href = oaUrl
    }
  }

  return (
    <div style={{ ...liffBindingShell, position: 'relative' }}>
      <BookLocaleToggle
        surface="header"
        style={{
          position: 'absolute',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          right: 16,
        }}
      />
      <div style={liffBindingCard}>
        <EsBrandLockup
          brand={s.header.brand}
          subtitle={s.header.title}
          variant="onLight"
          align="center"
          logoSize={48}
          style={{ marginBottom: 8, justifyContent: 'center' }}
        />
        <p style={{
          fontSize: LIFF_TYPE.body,
          color: LIFF_THEME.muted,
          margin: '0 0 24px',
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          {b.subtitle}
        </p>

        {bindingError && (
          <div style={{
            background: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: LIFF_TYPE.body, color: '#cf1322', marginBottom: '8px', fontWeight: '600' }}>
              ❌ {bindingError}
            </div>
            <div style={{ fontSize: 13, color: LIFF_THEME.muted, lineHeight: '1.5' }}>
              {b.errorHelp}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={liffLabel}>{b.phone}</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setBindingError(null)
            }}
            placeholder={b.phonePh}
            style={liffInput(!!bindingError)}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={liffLabel}>{b.birthday}</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              style={{ ...liffSelect, flex: 1.2 }}
            >
              <option value="">{b.year}</option>
              {Array.from({ length: 100 }, (_, i) => {
                const year = new Date().getFullYear() - i
                return <option key={year} value={year}>{year}</option>
              })}
            </select>
            <select
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value)}
              style={liffSelect}
            >
              <option value="">{b.month}</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                  {locale === 'zh' ? b.monthUnit(i + 1) : b.monthUnit(i + 1)}
                </option>
              ))}
            </select>
            <select
              value={birthDay}
              onChange={(e) => setBirthDay(e.target.value)}
              style={liffSelect}
            >
              <option value="">{b.day}</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                  {locale === 'zh' ? b.dayUnit(i + 1) : b.dayUnit(i + 1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={binding || !isFormValid}
          style={{ ...liffPrimaryBtn(!binding && !!isFormValid), marginBottom: '10px' }}
        >
          {binding ? b.submitting : b.submit}
        </button>

        <button
          type="button"
          onClick={onSkip}
          disabled={binding}
          style={{ ...liffGhostBtn, marginBottom: '16px', cursor: binding ? 'not-allowed' : 'pointer' }}
        >
          {b.skip}
        </button>

        {oaUrl && (
          <button type="button" onClick={openOfficialContact} style={liffLineBtn}>
            {b.contactOfficial}
          </button>
        )}
      </div>
    </div>
  )
}
