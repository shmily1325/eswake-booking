import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { SearchBookings } from './SearchBookings'
import { hasViewAccess } from '../utils/auth'
import { trackClickDedupedWithin } from '../utils/trackClick'
import { PageShell } from '../components/PageShell'
import { designSystem } from '../styles/designSystem'

export function SearchPage() {
  const user = useAuthUser()
  const navigate = useNavigate()

  // 權限檢查：需要一般權限
  useEffect(() => {
    const checkAccess = async () => {
      if (user) {
        const canAccess = await hasViewAccess(user)
        if (!canAccess) {
          navigate('/')
        }
      }
    }
    checkAccess()
  }, [user, navigate])

  useEffect(() => {
    if (!user?.email) return
    trackClickDedupedWithin('search_page_open', user.email)
  }, [user?.email])

  return (
    <PageShell
      variant="dashboard"
      mobilePadding="15px"
      desktopPadding="15px"
      outerStyle={{ background: designSystem.colors.background.main }}
    >
      <PageHeader title="🔍 預約查詢" user={user} />
      <SearchBookings isEmbedded={true} />
    </PageShell>
  )
}
