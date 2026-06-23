// 會員專區首次綁定（新 LINE 用戶進專區時；預約流程較少走到）

import { EsBrandLockup } from '../../../components/EsBrandLockup'
import { ES_BRAND } from '../../../lib/esBrandTokens'
import { liffTrack } from '../track'
import {
  liffBindingCard,
  liffBindingShell,
  liffInput,
  liffLabel,
  liffLineBtn,
  liffPrimaryBtn,
  liffSelect,
  LIFF_THEME,
  LIFF_TYPE,
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
      <div style={liffBindingCard}>
        <EsBrandLockup
          variant="onLight"
          subtitle={ES_BRAND.memberAreaLabel}
          align="center"
          logoSize={48}
          style={{ marginBottom: 8, justifyContent: 'center' }}
        />
        <p style={{
          fontSize: LIFF_TYPE.body,
          color: LIFF_THEME.muted,
          margin: '0 0 24px',
          textAlign: 'center',
        }}>
          首次使用需要綁定您的電話號碼
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
              如果您確定正確，請直接<strong>私訊官方帳號</strong>告知您的手機號碼，我們會協助您完成綁定！
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={liffLabel}>手機號碼</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setBindingError(null)
            }}
            placeholder="請輸入您的手機號碼"
            style={liffInput(!!bindingError)}
          />
          <div style={{ fontSize: LIFF_TYPE.caption, color: LIFF_THEME.mutedLight, marginTop: '6px' }}>
            例如：0912345678
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={liffLabel}>生日</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              style={{ ...liffSelect, flex: 1.2, color: birthYear ? LIFF_THEME.inkSoft : LIFF_THEME.mutedLight }}
            >
              <option value="">年</option>
              {Array.from({ length: 100 }, (_, i) => {
                const year = new Date().getFullYear() - i
                return <option key={year} value={year}>{year}</option>
              })}
            </select>
            <select
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value)}
              style={{ ...liffSelect, color: birthMonth ? LIFF_THEME.inkSoft : LIFF_THEME.mutedLight }}
            >
              <option value="">月</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}月</option>
              ))}
            </select>
            <select
              value={birthDay}
              onChange={(e) => setBirthDay(e.target.value)}
              style={{ ...liffSelect, color: birthDay ? LIFF_THEME.inkSoft : LIFF_THEME.mutedLight }}
            >
              <option value="">日</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}日</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={binding || !isFormValid}
          style={{ ...liffPrimaryBtn(!binding && !!isFormValid), marginBottom: '16px' }}
        >
          {binding ? '綁定中...' : '開始綁定'}
        </button>

        <div style={{
          background: LIFF_THEME.surfaceInset,
          padding: '12px',
          borderRadius: '12px',
          fontSize: LIFF_TYPE.caption,
          color: LIFF_THEME.muted,
          lineHeight: 1.5,
        }}>
          輸入手機與生日即可綁定
        </div>

        {oaUrl && (
          <div style={{ marginTop: '12px' }}>
            <div style={{
              background: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: '12px',
              padding: '12px',
              color: '#614700',
              fontSize: LIFF_TYPE.caption,
              lineHeight: 1.5,
            }}>
              <div style={{ marginBottom: 8 }}>尚未加入？私訊官方詢問</div>
              <button type="button" onClick={openOfficialContact} style={liffLineBtn}>
                私訊官方帳號
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
