import { useState } from 'react'
import { AdminPillButton, AdminPillRow } from '../../components/AdminPageLayout'
import { Footer } from '../../components/Footer'
import { PageHeader } from '../../components/PageHeader'
import { PageShell } from '../../components/PageShell'
import { useAuthUser } from '../../contexts/AuthContext'
import { useResponsive } from '../../hooks/useResponsive'
import { isAdmin } from '../../utils/auth'
import { CoachReport } from './CoachReport'
import { AdminCoachDesignatedHours } from './designatedHours/AdminCoachDesignatedHours'

type WorkspaceView = 'report' | 'designated'

export function AdminCoachReportWorkspace() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()
  const [activeView, setActiveView] = useState<WorkspaceView>('report')

  if (!isAdmin(user)) return <CoachReport />

  return (
    <PageShell variant="focused" mobilePadding="16px" desktopPadding="24px">
      <PageHeader
        user={user}
        title="回報"
        extraLinks={[{ label: '回報管理 →', link: '/coach-admin' }]}
      />

      <AdminPillRow style={{ marginBottom: isMobile ? 12 : 16 }}>
        <AdminPillButton
          active={activeView === 'report'}
          onClick={() => setActiveView('report')}
          data-track="admin_report_workspace_report"
        >
          回報
        </AdminPillButton>
        <AdminPillButton
          active={activeView === 'designated'}
          onClick={() => setActiveView('designated')}
          data-track="admin_report_workspace_designated"
        >
          指定課
        </AdminPillButton>
      </AdminPillRow>

      {activeView === 'report' ? (
        <CoachReport embedded hideFooter />
      ) : (
        <AdminCoachDesignatedHours isMobile={isMobile} />
      )}

      <Footer />
    </PageShell>
  )
}
