import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { useResponsive } from '../hooks/useResponsive'
import { getLocalTimestamp } from '../utils/date'

interface LineSettingsProps {
  user: User
}

export function LineSettings({ user }: LineSettingsProps) {
  const { isMobile } = useResponsive()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [enabled, setEnabled] = useState(false)
  const [accessToken, setAccessToken] = useState('')
  const [reminderTime, setReminderTime] = useState('19:00')
  const [bindingStats, setBindingStats] = useState({ total: 0, bound: 0 })

  useEffect(() => {
    loadSettings()
    loadBindingStats()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', ['line_reminder_enabled', 'line_channel_access_token', 'line_reminder_time'])

      if (data) {
        data.forEach(item => {
          if (item.setting_key === 'line_reminder_enabled') {
            setEnabled(item.setting_value === 'true')
          } else if (item.setting_key === 'line_channel_access_token') {
            setAccessToken(item.setting_value || '')
          } else if (item.setting_key === 'line_reminder_time') {
            setReminderTime(item.setting_value || '19:00')
          }
        })
      }
    } catch (error) {
      console.error('載入設置失敗:', error)
      alert('❌ 載入設置失敗')
    } finally {
      setLoading(false)
    }
  }

  const loadBindingStats = async () => {
    try {
      const { data: members } = await supabase
        .from('members')
        .select('id, line_user_id')
        .eq('status', 'active')

      if (members) {
        setBindingStats({
          total: members.length,
          bound: members.filter(m => m.line_user_id).length
        })
      }
    } catch (error) {
      console.error('載入統計失敗:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = [
        { setting_key: 'line_reminder_enabled', setting_value: enabled.toString() },
        { setting_key: 'line_channel_access_token', setting_value: accessToken },
        { setting_key: 'line_reminder_time', setting_value: reminderTime }
      ]

      for (const update of updates) {
        await supabase
          .from('system_settings')
          .update({ 
            setting_value: update.setting_value,
            updated_by: user.id,
            updated_at: getLocalTimestamp()
          })
          .eq('setting_key', update.setting_key)
      }

      alert('✅ 設置已儲存')
    } catch (error) {
      console.error('儲存失敗:', error)
      alert('❌ 儲存失敗')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ 
        padding: isMobile ? '12px' : '20px',
        minHeight: '100vh',
        background: '#f5f5f5',
        textAlign: 'center'
      }}>
        <PageHeader title="📱 LINE 提醒設置" user={user} showBaoLink={true} />
        <div style={{ fontSize: '18px', color: '#666', marginTop: '40px' }}>
          載入中...
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      padding: isMobile ? '12px' : '20px',
      minHeight: '100vh',
      background: '#f5f5f5'
    }}>
      <PageHeader title="📱 LINE 提醒設置" user={user} showBaoLink={true} />

      {/* 功能開關 */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '24px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '12px'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>啟用 LINE 預約提醒</h3>
            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#666' }}>
              自動發送明日預約提醒給已綁定的會員
            </p>
          </div>
          <label style={{
            position: 'relative',
            display: 'inline-block',
            width: '60px',
            height: '34px',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: enabled ? '#4CAF50' : '#ccc',
              borderRadius: '34px',
              transition: '0.4s',
              cursor: 'pointer'
            }}>
              <span style={{
                position: 'absolute',
                content: '',
                height: '26px',
                width: '26px',
                left: enabled ? '30px' : '4px',
                bottom: '4px',
                background: 'white',
                borderRadius: '50%',
                transition: '0.4s'
              }} />
            </span>
          </label>
        </div>

        {/* 綁定統計 */}
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '14px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            📊 綁定統計：<strong>{bindingStats.bound}</strong> / {bindingStats.total} 位會員已綁定
          </div>
          <div style={{ 
            width: '100%', 
            height: '8px', 
            background: '#e0e0e0', 
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${bindingStats.total > 0 ? (bindingStats.bound / bindingStats.total * 100) : 0}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #4CAF50, #81C784)',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>
      </div>

      {/* Access Token 設置 */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '24px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>🔑 LINE Channel Access Token</h3>
        <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#666' }}>
          從 LINE Developers Console 獲取 Channel Access Token
        </p>
        <input
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="貼上你的 Channel Access Token"
          style={{
            width: '100%',
            padding: '12px',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '14px',
            boxSizing: 'border-box'
          }}
        />
        <a 
          href="https://developers.line.biz/console/" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            marginTop: '8px',
            color: '#06C755',
            fontSize: '14px',
            textDecoration: 'none'
          }}
        >
          → 前往 LINE Developers Console
        </a>
      </div>

      {/* 提醒時間設置 */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '24px',
        marginBottom: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '18px' }}>⏰ 提醒時間</h3>
        <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#666' }}>
          設置每天發送提醒的時間（前一天）
        </p>
        <input
          type="time"
          value={reminderTime}
          onChange={(e) => setReminderTime(e.target.value)}
          style={{
            padding: '12px',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            fontSize: '16px'
          }}
        />
      </div>

      {/* 說明 */}
      <div style={{
        background: '#FFF3CD',
        borderRadius: '12px',
        padding: isMobile ? '16px' : '24px',
        marginBottom: '16px',
        border: '1px solid #FFC107'
      }}>
        <h4 style={{ margin: '0 0 12px', fontSize: '16px', color: '#856404' }}>
          💡 使用說明
        </h4>
        <div style={{ fontSize: '14px', color: '#856404', lineHeight: '1.6' }}>
          1. 在 LINE Developers Console 創建 Messaging API Channel<br/>
          2. 複製 Channel Access Token 並填入上方<br/>
          3. 在 Vercel 設置環境變數（需要的變數）<br/>
          4. 會員掃描 QR Code 加入官方帳號並發送「綁定 電話號碼」<br/>
          5. 系統將在設定時間自動發送明日預約提醒
        </div>
      </div>

      {/* 儲存按鈕 */}
      <div style={{
        position: 'sticky',
        bottom: isMobile ? '12px' : '20px',
        background: 'white',
        padding: '16px',
        borderRadius: '12px',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)'
      }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%',
            padding: '16px',
            background: saving ? '#ccc' : 'linear-gradient(135deg, #06C755 0%, #00B14F 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: saving ? 'not-allowed' : 'pointer'
          }}
        >
          {saving ? '儲存中...' : '💾 儲存設置'}
        </button>
      </div>

      <Footer />
    </div>
  )
}

