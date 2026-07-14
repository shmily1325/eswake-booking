// 會員專區首次綁定（新 LINE 用戶進專區時；預約流程較少走到）

import { EsBrandLockup } from '../../../components/EsBrandLockup'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { getFontSizePx } from '../../../styles/designSystem'
import { liffTrack } from '../track'
import {
  liffBindingCard,
  liffBindingShell,
  liffGhostBtn,
  liffInput,
  liffLabel,
  liffPrimaryBtn,
  liffSelect,
  LIFF_THEME,
} from '../liffUiStyles'

interface BindingFormProps {
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
}

export function BindingForm({
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
}: BindingFormProps) {
  const isFormValid = phone && birthYear && birthMonth && birthDay
  const oaUrl = import.meta.env.VITE_LINE_OA_URL as string | undefined

  function openOfficialContact() {
    if (!oaUrl) return
    try {
      liffTrack({ icon_id: 'liff_contact_official', line_user_id: null })
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
    <div style={liffBindingShell}>
      <div style={{ ...liffBindingCard, padding: '40px 24px 28px' }}>
        <EsBrandLockup
          variant="onLight"
          subtitle={ES_BRAND.memberAreaLabel}
          align="center"
          logoSize={56}
          style={{ marginBottom: 12, justifyContent: 'center' }}
        />
        <p
          style={{
            fontSize: getFontSizePx('body', true),
            color: LIFF_THEME.muted,
            margin: '0 0 28px',
            textAlign: 'center',
            lineHeight: 1.55,
          }}
        >
          用手機與生日確認身份
        </p>

        <div style={{ marginBottom: 18 }}>
          <label style={liffLabel}>手機號碼</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setBindingError(null)
            }}
            placeholder="0912345678"
            style={liffInput(!!bindingError)}
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={liffLabel}>生日</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={birthYear}
              onChange={(e) => {
                setBirthYear(e.target.value)
                setBindingError(null)
              }}
              style={{
                ...liffSelect,
                flex: 1.2,
                color: birthYear ? LIFF_THEME.inkSoft : LIFF_THEME.mutedLight,
              }}
            >
              <option value="">年</option>
              {Array.from({ length: 100 }, (_, i) => {
                const year = new Date().getFullYear() - i
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                )
              })}
            </select>
            <select
              value={birthMonth}
              onChange={(e) => {
                setBirthMonth(e.target.value)
                setBindingError(null)
              }}
              style={{
                ...liffSelect,
                color: birthMonth ? LIFF_THEME.inkSoft : LIFF_THEME.mutedLight,
              }}
            >
              <option value="">月</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                  {i + 1}月
                </option>
              ))}
            </select>
            <select
              value={birthDay}
              onChange={(e) => {
                setBirthDay(e.target.value)
                setBindingError(null)
              }}
              style={{
                ...liffSelect,
                color: birthDay ? LIFF_THEME.inkSoft : LIFF_THEME.mutedLight,
              }}
            >
              <option value="">日</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                  {i + 1}日
                </option>
              ))}
            </select>
          </div>
        </div>

        {bindingError && (
          <div
            style={{
              marginTop: 12,
              marginBottom: 4,
              fontSize: getFontSizePx('button', true),
              color: LIFF_THEME.dangerText,
              lineHeight: 1.5,
            }}
          >
            {bindingError}
            {oaUrl ? ' 若資料正確，可私訊官方協助綁定。' : null}
          </div>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={binding || !isFormValid}
          style={{
            ...liffPrimaryBtn(!binding && !!isFormValid),
            marginTop: 24,
            marginBottom: oaUrl ? 12 : 0,
          }}
        >
          {binding ? '綁定中…' : '開始綁定'}
        </button>

        {oaUrl && (
          <button type="button" onClick={openOfficialContact} style={liffGhostBtn}>
            私訊官方帳號
          </button>
        )}
      </div>
    </div>
  )
}
