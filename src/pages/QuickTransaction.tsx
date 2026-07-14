import { useAuthUser } from '../contexts/AuthContext'
import { PageHeader } from '../components/PageHeader'
import { Footer } from '../components/Footer'
import { PageShell } from '../components/PageShell'
import { useResponsive } from '../hooks/useResponsive'
import { isAdmin } from '../utils/auth'

export function QuickTransaction() {
  const user = useAuthUser()
  const { isMobile } = useResponsive()

  return (
    <PageShell
      variant="content"
      mobilePadding="12px"
      desktopPadding="20px"
      outerStyle={{ background: '#f5f5f5' }}
    >
        <PageHeader title="儲值" user={user} showBaoLink={isAdmin(user)} />

        {/* 即將推出提示 */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        padding: '40px 20px'
      }}>
        <div style={{
          fontSize: isMobile ? '80px' : '120px',
          marginBottom: '20px',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          🚧
        </div>
        
        <h2 style={{
          fontSize: isMobile ? '24px' : '32px',
          fontWeight: 'bold',
          color: '#333',
          marginBottom: '15px',
          margin: 0
        }}>
          預留功能
        </h2>
        
        <p style={{
          fontSize: isMobile ? '16px' : '18px',
          color: '#666',
          maxWidth: '600px',
          lineHeight: '1.6',
          margin: '15px 0'
        }}>
          此功能為未來擴展預留
        </p>
        </div>

        <Footer />

        <style>{`
          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.05);
              opacity: 0.8;
            }
          }
        `}</style>
    </PageShell>
  )
}
