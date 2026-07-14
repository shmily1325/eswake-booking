import { useState, useEffect } from 'react'
import { useAuthUser } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PageHeader } from '../../components/PageHeader'
import { useResponsive } from '../../hooks/useResponsive'
import { useToast } from '../../components/ui'
import { CoachReport } from './CoachReport'
import { StatisticsTab } from '../../components/StatisticsTab'
import { CoachSchedulePreviewTable } from './CoachSchedulePreviewTable'
import { AdminTabBar, AdminTabButton } from '../../components/AdminPageLayout'
import { designSystem, getFontSize } from '../../styles/designSystem'
import { PageShell } from '../../components/PageShell'

export function MyReport() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const toast = useToast()
  
  const [activeTab, setActiveTab] = useState<'report' | 'history' | 'schedule'>('report')
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
      <PageShell variant="dashboard" mobilePadding="16px" desktopPadding="24px">
          <PageHeader 
            user={user} 
            title="教練回報"
            showBaoLink={false}
          />
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: getFontSize('bodyLarge', isMobile),
            color: designSystem.colors.text.secondary,
            marginTop: '100px'
          }}>
            檢查權限中...
          </div>
      </PageShell>
    )
  }

  return (
    <PageShell variant="dashboard" mobilePadding="16px" desktopPadding="24px">
        <PageHeader 
          user={user} 
          title="教練回報"
          showBaoLink={false}
        />

        {/* Tab 切換 */}
        <AdminTabBar>
          <AdminTabButton
            data-track="my_report_tab_report"
            active={activeTab === 'report'}
            onClick={() => setActiveTab('report')}
          >
            回報
          </AdminTabButton>
          <AdminTabButton
            data-track="my_report_tab_history"
            active={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
          >
            細帳
          </AdminTabButton>
          <AdminTabButton
            data-track="my_report_tab_schedule"
            active={activeTab === 'schedule'}
            onClick={() => setActiveTab('schedule')}
          >
            排程
          </AdminTabButton>
        </AdminTabBar>

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

          {/* 排程預覽 Tab */}
          {activeTab === 'schedule' && coachId && (
            <CoachSchedulePreviewTable coachId={coachId} isMobile={isMobile} />
          )}
        </div>
    </PageShell>
  )
}
