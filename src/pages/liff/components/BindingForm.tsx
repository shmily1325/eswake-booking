// 綁定表單組件
import { liffTrack } from '../track'

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
  onSubmit
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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #4a4a4a 0%, #3a3a3a 100%)',
      padding: '20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px 24px',
        maxWidth: '400px',
        width: '100%',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
      }}>
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <img 
            src="/logo_circle (black).png" 
            alt="ES Wake Logo" 
            style={{ 
              width: '80px', 
              height: '80px', 
              marginBottom: '16px',
              objectFit: 'contain'
            }} 
          />
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#333',
            margin: '0 0 8px'
          }}>
            ES WAKE 會員專區
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#666',
            margin: 0
          }}>
            首次使用需要綁定您的電話號碼
          </p>
          <p style={{
            fontSize: '11px',
            color: '#999',
            margin: '8px 0 0',
            fontFamily: 'monospace'
          }}>
            v20251208-003
          </p>
        </div>

        {/* 錯誤提示 */}
        {bindingError && (
          <div style={{
            background: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px'
          }}>
            <div style={{ fontSize: '14px', color: '#cf1322', marginBottom: '8px', fontWeight: '600' }}>
              ❌ {bindingError}
            </div>
            <div style={{ fontSize: '13px', color: '#666', lineHeight: '1.5' }}>
              如果您確定正確，請直接<strong>私訊官方帳號</strong>告知您的手機號碼，我們會協助您完成綁定！
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#555',
            marginBottom: '8px'
          }}>
            手機號碼
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setBindingError(null)
            }}
            placeholder="請輸入您的手機號碼"
            style={{
              width: '100%',
              padding: '14px',
              border: bindingError ? '2px solid #ff4d4f' : '2px solid #e0e0e0',
              borderRadius: '8px',
              fontSize: '16px',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#5a5a5a'}
            onBlur={(e) => e.target.style.borderColor = bindingError ? '#ff4d4f' : '#e0e0e0'}
          />
          <div style={{
            fontSize: '12px',
            color: '#999',
            marginTop: '6px'
          }}>
            例如：0912345678
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '600',
            color: '#555',
            marginBottom: '8px'
          }}>
            生日
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* 年 */}
            <select
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              style={{
                flex: 1.2,
                padding: '14px 8px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                outline: 'none',
                background: 'white',
                color: birthYear ? '#333' : '#999'
              }}
            >
              <option value="">年</option>
              {Array.from({ length: 100 }, (_, i) => {
                const year = new Date().getFullYear() - i
                return <option key={year} value={year}>{year}</option>
              })}
            </select>
            {/* 月 */}
            <select
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value)}
              style={{
                flex: 1,
                padding: '14px 8px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                outline: 'none',
                background: 'white',
                color: birthMonth ? '#333' : '#999'
              }}
            >
              <option value="">月</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}月</option>
              ))}
            </select>
            {/* 日 */}
            <select
              value={birthDay}
              onChange={(e) => setBirthDay(e.target.value)}
              style={{
                flex: 1,
                padding: '14px 8px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                fontSize: '16px',
                boxSizing: 'border-box',
                outline: 'none',
                background: 'white',
                color: birthDay ? '#333' : '#999'
              }}
            >
              <option value="">日</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{i + 1}日</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={onSubmit}
          disabled={binding || !isFormValid}
          style={{
            width: '100%',
            padding: '14px',
            background: binding || !isFormValid
              ? '#ccc' 
              : 'linear-gradient(135deg, #5a5a5a 0%, #4a4a4a 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: binding || !isFormValid ? 'not-allowed' : 'pointer',
            transition: 'transform 0.1s',
            marginBottom: '16px'
          }}
          onMouseDown={(e) => {
            if (!binding && isFormValid) {
              (e.target as HTMLElement).style.transform = 'scale(0.98)'
            }
          }}
          onMouseUp={(e) => {
            (e.target as HTMLElement).style.transform = 'scale(1)'
          }}
        >
          {binding ? '綁定中...' : '開始綁定'}
        </button>

        <div style={{
          background: '#f8f9fa',
          padding: '16px',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#666',
          lineHeight: '1.6'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '8px', color: '#555' }}>
            💡 綁定說明
          </div>
          • 請輸入您的手機與生日<br/>
          • 綁定後即可查看預約與儲值紀錄
        </div>

        {/* 非會員提示與官方聯絡 */}
        <div style={{ marginTop: '12px' }}>
          <div style={{
            background: '#fff7e6',
            border: '1px solid #ffd591',
            borderRadius: '8px',
            padding: '14px 16px',
            color: '#8c6d1f',
            fontSize: '13px',
            lineHeight: 1.6
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              不是會員嗎？
            </div>
            <div style={{ marginBottom: 10 }}>
              若您尚未加入 ES Wake 會員，請私訊官方帳號洽詢加入流程，我們會盡快回覆您。
            </div>
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
                  cursor: 'pointer'
                }}
              >
                私訊官方帳號
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

