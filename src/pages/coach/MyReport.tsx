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
        {/* 頁面標題 */}
        <h1 style={{ 
          fontSize: isMobile ? '24px' : '32px',
          fontWeight: 'bold',
          marginBottom: '24px',
          color: '#333'
        }}>
          📝 教練回報
        </h1>

        {/* Tab 切換 */}
        <div style={{ 
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid #e0e0e0',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setActiveTab('unreported')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'unreported' ? '#ff9800' : 'transparent',
              color: activeTab === 'unreported' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'unreported' ? '3px solid #ff9800' : 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            ⚠️ 待回報
          </button>
          <button
            onClick={() => setActiveTab('date')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'date' ? '#2196f3' : 'transparent',
              color: activeTab === 'date' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'date' ? '3px solid #2196f3' : 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            📅 按日期
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'history' ? '#4caf50' : 'transparent',
              color: activeTab === 'history' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'history' ? '3px solid #4caf50' : 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            📊 細帳
          </button>
        </div>

        {/* Tab 內容區 */}
        <div>
          {/* 待回報 Tab */}
          {activeTab === 'unreported' && coachId && (
            <CoachReport 
              autoFilterByUser={true} 
              embedded={true} 
              defaultViewMode="unreported"
              hideInternalTabs={true}
            />
          )}

          {/* 按日期 Tab */}
          {activeTab === 'date' && coachId && (
            <CoachReport 
              autoFilterByUser={true} 
              embedded={true} 
              defaultViewMode="date"
              hideInternalTabs={true}
            />
          )}

          {/* 細帳 Tab */}
          {activeTab === 'history' && coachId && (
            <StatisticsTab isMobile={isMobile} autoFilterCoachId={coachId} />
          )}
        </div>
      </div>

    </div>
  )
}

