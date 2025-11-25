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
        {/* Tab 切換 */}
        <div style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '0',
          borderBottom: '2px solid #e0e0e0'
        }}>
          <button
            onClick={() => setActiveTab('report')}
            style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '14px 16px' : '14px 32px',
              background: activeTab === 'report' ? 'white' : 'transparent',
              color: activeTab === 'report' ? '#2196f3' : '#999',
              border: 'none',
              borderBottom: activeTab === 'report' ? '3px solid #2196f3' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            📝 回報
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: isMobile ? 1 : 'none',
              padding: isMobile ? '14px 16px' : '14px 32px',
              background: activeTab === 'history' ? 'white' : 'transparent',
              color: activeTab === 'history' ? '#4caf50' : '#999',
              border: 'none',
              borderBottom: activeTab === 'history' ? '3px solid #4caf50' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: isMobile ? '15px' : '16px',
              fontWeight: '600',
              transition: 'all 0.2s',
              marginBottom: '-2px'
            }}
          >
            📊 細帳
          </button>
        </div>


        {/* 回報 Tab - 嵌入 CoachReport */}
        {activeTab === 'report' && coachId && (
          <div style={{ margin: '-24px' }}>
            <CoachReport autoFilterByUser={true} embedded={true} />
          </div>
        )}

        {/* 細帳 Tab - 使用 StatisticsTab 組件 */}
        {activeTab === 'history' && coachId && (
          <div style={{ 
            background: 'white',
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
            marginTop: '0'
          }}>
            <StatisticsTab isMobile={isMobile} autoFilterCoachId={coachId} />
          </div>
        )}
      </div>

    </div>
  )
}

