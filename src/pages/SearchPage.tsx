import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthUser } from '../contexts/AuthContext'
import { SearchBookings } from './SearchBookings'
import { hasViewAccess } from '../utils/auth'
import { trackClickDedupedWithin } from '../utils/trackClick'

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

  return <SearchBookings />
}
