/**
 * 預約表單專用綁定畫面（與會員專區 BindingForm 分離，不共用、不修改原元件）
 */
import { liffTrack } from '../track'
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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%)',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    }}>
      <BookLocaleToggle
        surface="header"
        style={{
          position: 'absolute',
          top: 'calc(16px + env(safe-area-inset-top, 0px))',
          right: 16,
        }}
      />
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px 24px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img
            src="/logo_circle (black).png"
            alt="ES Wake Logo"
            style={{
              width: '80px',
              height: '80px',
              marginBottom: '16px',
              objectFit: 'contain',
              display: 'block',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          />
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#333', margin: '0 0 8px' }}>
            {b.title}
          </h1>
          <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
            {b.subtitle}
          </p>
        </div>

        {bindingError && (
          <div style={{
            background: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
          }}>
            <div style={{ fontSize: '14px', color: '#cf1322', marginBottom: '8px', fontWeight: '600' }}>
              ❌ {bindingError}
            </div>
            <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
              {b.errorHelp}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#555', marginBottom: '8px' }}>
            {b.phone}
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setBindingError(null)
            }}
            placeholder={b.phonePh}
            style={{
              width: '100%',
              padding: '14px',
              border: bindingError ? '2px solid #ff4d4f' : '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '16px',
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#555', marginBottom: '8px' }}>
            {b.birthday}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              style={{ flex: 1.2, padding: '14px 8px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '16px', background: 'white' }}
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
              style={{ flex: 1, padding: '14px 8px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '16px', background: 'white' }}
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
              style={{ flex: 1, padding: '14px 8px', border: '2px solid #e0e0e0', borderRadius: '8px', fontSize: '16px', background: 'white' }}
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
          style={{
            width: '100%',
            padding: '14px',
            background: binding || !isFormValid ? '#ccc' : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: binding || !isFormValid ? 'not-allowed' : 'pointer',
            marginBottom: '10px',
          }}
        >
          {binding ? b.submitting : b.submit}
        </button>

        <button
          type="button"
          onClick={onSkip}
          disabled={binding}
          style={{
            width: '100%',
            padding: '12px',
            background: 'transparent',
            color: '#666',
            border: 'none',
            fontSize: '14px',
            cursor: binding ? 'not-allowed' : 'pointer',
            marginBottom: '16px',
          }}
        >
          {b.skip}
        </button>

        {oaUrl && (
          <button
            type="button"
            onClick={openOfficialContact}
            style={{
              width: '100%',
              padding: '12px',
              background: '#00b900',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {b.contactOfficial}
          </button>
        )}
      </div>
    </div>
  )
}
