import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { useResponsive } from '../../hooks/useResponsive'
import { useToast } from '../../components/ui'
import { CoachReport } from './CoachReport'
import { StatisticsTab } from '../../components/StatisticsTab'

export function MyReport() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const toast = useToast()
  
  const [activeTab, setActiveTab] = useState<'unreported' | 'date' | 'history'>('unreported')
  const [coachId, setCoachId] = useState<string | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // 載入教練資訊
  useEffect(() => {
    const loadCoachInfo = async () => {
      if (!user?.email) return
      
      setCheckingAuth(true)

      const { data, error } = await supabase
        .from('coaches')
        .select('id, name')
        .eq('user_email', user.email)
        .single()

      if (error || !data) {
        console.error('載入教練資訊失敗:', error)
        toast.error('載入失敗，請重新整理頁面')
        setCheckingAuth(false)
        return
      }

      setCoachId(data.id)
      setCheckingAuth(false)
    }

    loadCoachInfo()
  }, [user?.email])


  // 檢查權限中
  if (checkingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
        <PageHeader 
          user={user} 
          title="教練回報"
          showBaoLink={false}
        />
        <div style={{ 
          flex: 1, 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          color: '#999'
        }}>
          檢查權限中...
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <PageHeader 
        user={user} 
        title="教練回報"
        showBaoLink={false}
      />
      
      <div style={{ 
        flex: 1, 
        padding: isMobile ? '16px' : '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Tab 切換 - 三個同層級的 tab */}
        <div style={{
          display: 'flex',
          gap: '0',
          marginBottom: '0',
          background: 'white',
          borderRadius: '12px 12px 0 0',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <button
            onClick={() => setActiveTab('unreported')}
            style={{
              flex: 1,
              padding: isMobile ? '14px 8px' : '16px 24px',
              background: activeTab === 'unreported' ? 'white' : '#f5f5f5',
              color: activeTab === 'unreported' ? '#e65100' : '#888',
              border: 'none',
              borderBottom: activeTab === 'unreported' ? '3px solid #e65100' : '3px solid #e0e0e0',
              cursor: 'pointer',
              fontSize: isMobile ? '13px' : '15px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            ⚠️ 待回報
          </button>
          <button
            onClick={() => setActiveTab('date')}
            style={{
              flex: 1,
              padding: isMobile ? '14px 8px' : '16px 24px',
              background: activeTab === 'date' ? 'white' : '#f5f5f5',
              color: activeTab === 'date' ? '#1976d2' : '#888',
              border: 'none',
              borderBottom: activeTab === 'date' ? '3px solid #1976d2' : '3px solid #e0e0e0',
              cursor: 'pointer',
              fontSize: isMobile ? '13px' : '15px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            📅 按日期
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: isMobile ? '14px 8px' : '16px 24px',
              background: activeTab === 'history' ? 'white' : '#f5f5f5',
              color: activeTab === 'history' ? '#388e3c' : '#888',
              border: 'none',
              borderBottom: activeTab === 'history' ? '3px solid #388e3c' : '3px solid #e0e0e0',
              cursor: 'pointer',
              fontSize: isMobile ? '13px' : '15px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            📊 細帳
          </button>
        </div>


        {/* 待回報 Tab - 顯示未回報的預約 */}
        {activeTab === 'unreported' && coachId && (
          <div style={{ 
            background: 'white',
            borderRadius: '0 0 12px 12px',
            padding: isMobile ? '16px' : '20px'
          }}>
            <CoachReport 
              autoFilterByUser={true} 
              embedded={true} 
              defaultViewMode="unreported"
              hideInternalTabs={true}
            />
          </div>
        )}

        {/* 按日期 Tab - 按日期查看回報 */}
        {activeTab === 'date' && coachId && (
          <div style={{ 
            background: 'white',
            borderRadius: '0 0 12px 12px',
            padding: isMobile ? '16px' : '20px'
          }}>
            <CoachReport 
              autoFilterByUser={true} 
              embedded={true} 
              defaultViewMode="date"
              hideInternalTabs={true}
            />
          </div>
        )}

        {/* 細帳 Tab - 使用 StatisticsTab 組件 */}
        {activeTab === 'history' && coachId && (
          <div style={{ 
            background: 'white',
            borderRadius: '0 0 12px 12px',
            padding: isMobile ? '16px' : '20px'
          }}>
            <StatisticsTab isMobile={isMobile} autoFilterCoachId={coachId} />
          </div>
        )}
      </div>

    </div>
  )
}

