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
  
  const [activeTab, setActiveTab] = useState<'report' | 'history'>('report')
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
        <div style={{ 
          flex: 1, 
          padding: isMobile ? '16px' : '24px',
        }}>
          <PageHeader 
            user={user} 
            title="📝 教練回報"
            showBaoLink={false}
          />
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            color: '#999',
            marginTop: '100px'
          }}>
            檢查權限中...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      <div style={{ 
        flex: 1, 
        padding: isMobile ? '16px' : '24px',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
        <PageHeader 
          user={user} 
          title="📝 教練回報"
          showBaoLink={false}
        />

        {/* Tab 切換 */}
        <div style={{ 
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          borderBottom: '2px solid #e0e0e0',
          flexWrap: 'wrap'
        }}>
          <button
            data-track="my_report_tab_report"
            onClick={() => setActiveTab('report')}
            style={{
              padding: '12px 24px',
              background: activeTab === 'report' ? '#2196f3' : 'transparent',
              color: activeTab === 'report' ? 'white' : '#666',
              border: 'none',
              borderBottom: activeTab === 'report' ? '3px solid #2196f3' : 'none',
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
            📝 回報
          </button>
          <button
            data-track="my_report_tab_history"
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
          {/* 回報 Tab */}
          {activeTab === 'report' && coachId && (
            <CoachReport 
              autoFilterByUser={true} 
              embedded={true} 
              defaultViewMode="unreported"
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

