import { useAuthUser } from '../contexts/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { SearchBookings } from './SearchBookings'

export function SearchPage() {
  const user = useAuthUser()
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8f9fa',
      padding: '15px'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        <PageHeader title="🔍 預約查詢" user={user} />
        <SearchBookings isEmbedded={true} />
      </div>
    </div>
  )
}
